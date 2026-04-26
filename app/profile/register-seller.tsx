import React, { useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native'
import { useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'

import Button from '@/components/Button'
import Input from '@/components/Input'
import BottomSheet from '@/components/BottomSheet'
import Loading from '@/components/Loading'
import { COLORS, FONTS, SIZES } from '@/constants/theme'
import { profileService } from '@/services/profile-service'
import {
  vietnamProvincesService,
  type District,
  type Province,
  type Ward,
} from '@/services/vietnam-provinces'
import { supabase } from '@/lib/supabase'
import { normalizeVietnamPhone, isVietnamPhoneLocal } from '@/utils/phone-vn'
import type {
  RegisterSellerRequest,
  SellerIdentityInfo,
  ShopDocumentInput,
  UserProfileResponse,
} from '@/types/profile'
import { recognizeVietnamIdCard, type VnmIdOcrData } from '@/services/vnm-id-ocr'

type Step = 1 | 2 | 3 | 4

type SellerFormState = {
  shopName: string
  shopDescription: string
  phone: string
  addressLine: string
  wardCode: string
  districtId: string
  provinceId: string
  city: string
  businessLicenseNumber: string
  taxCode: string
  businessType: RegisterSellerRequest['businessType']
  bankName: string
  bankAccountNumber: string
  bankAccountName: string
}

type DocSlot = {
  docType: string
  label: string
  required: boolean
  hint: string
}

type DocFile = {
  uri: string
  mimeType: string
  fileSize?: number
  uploaded: boolean
  fileUrl: string
}

const STEP_LABELS: Record<Step, string> = {
  1: 'Thông tin shop',
  2: 'Địa chỉ lấy hàng',
  3: 'Hồ sơ doanh nghiệp',
  4: 'Xác minh danh tính',
}

const INITIAL_FORM: SellerFormState = {
  shopName: '',
  shopDescription: '',
  phone: '',
  addressLine: '',
  wardCode: '',
  districtId: '',
  provinceId: '',
  city: '',
  businessLicenseNumber: '',
  taxCode: '',
  businessType: 'individual',
  bankName: '',
  bankAccountNumber: '',
  bankAccountName: '',
}

const DOC_SLOT_CCCD_FRONT: DocSlot = {
  docType: 'cccd_front',
  label: 'CCCD mặt trước',
  required: true,
  hint: 'Bắt buộc — tối đa 5 MB',
}
const DOC_SLOT_CCCD_BACK: DocSlot = {
  docType: 'cccd_back',
  label: 'CCCD mặt sau',
  required: true,
  hint: 'Bắt buộc — tối đa 5 MB',
}
const DOC_SLOT_GPKD: DocSlot = {
  docType: 'business_license',
  label: 'Giấy phép kinh doanh',
  required: true,
  hint: 'Bắt buộc với hộ kinh doanh và công ty',
}
const DOC_SLOT_TAX: DocSlot = {
  docType: 'tax_cert',
  label: 'Giấy chứng nhận MST (tuỳ chọn)',
  required: false,
  hint: 'Tuỳ chọn — nếu có',
}

/** Khớp web: luôn có CCCD; hộ/công ty thêm GPKD/MST (upload lên server chỉ GPKD/MST, CCCD dùng OCR) */
function getDocSlots(businessType: string): DocSlot[] {
  const slots: DocSlot[] = [DOC_SLOT_CCCD_FRONT, DOC_SLOT_CCCD_BACK]
  if (businessType === 'company' || businessType === 'household') {
    slots.push(DOC_SLOT_GPKD, DOC_SLOT_TAX)
  }
  return slots
}

type IdCardFormState = {
  name: string
  idNumber: string
  dob: string
  sex: string
  nationality: string
  home: string
  address: string
  addrProvince: string
  addrDistrict: string
  addrWard: string
  addrStreet: string
  doe: string
  cardType: string
  issueDate: string
  issueLoc: string
  religion: string
  ethnicity: string
  features: string
}

const INITIAL_ID_CARD: IdCardFormState = {
  name: '',
  idNumber: '',
  dob: '',
  sex: '',
  nationality: '',
  home: '',
  address: '',
  addrProvince: '',
  addrDistrict: '',
  addrWard: '',
  addrStreet: '',
  doe: '',
  cardType: '',
  issueDate: '',
  issueLoc: '',
  religion: '',
  ethnicity: '',
  features: '',
}

function cleanOcrValue(v: string | null | undefined): string {
  if (v == null) return ''
  const t = String(v).trim()
  if (!t || t.toUpperCase() === 'N/A') return ''
  return t
}

function clearFrontOcrPart(prev: IdCardFormState): IdCardFormState {
  return {
    ...prev,
    name: '',
    idNumber: '',
    dob: '',
    sex: '',
    nationality: '',
    home: '',
    address: '',
    addrProvince: '',
    addrDistrict: '',
    addrWard: '',
    addrStreet: '',
    doe: '',
    cardType: '',
  }
}

function clearBackOcrPart(prev: IdCardFormState): IdCardFormState {
  return {
    ...prev,
    issueDate: '',
    issueLoc: '',
    religion: '',
    ethnicity: '',
    features: '',
  }
}

function mergeOcrIntoIdForm(prev: IdCardFormState, d: VnmIdOcrData): IdCardFormState {
  const n = { ...prev }
  const set = (k: keyof IdCardFormState, v: string | null | undefined) => {
    const t = cleanOcrValue(v)
    if (t) (n as Record<string, string>)[k] = t
  }
  set('name', d.name)
  set('idNumber', d.id)
  set('dob', d.dob)
  set('sex', d.sex)
  set('nationality', d.nationality)
  set('home', d.home)
  set('address', d.address)
  if (d.addressEntities) {
    set('addrProvince', d.addressEntities.province)
    set('addrDistrict', d.addressEntities.district)
    set('addrWard', d.addressEntities.ward)
    set('addrStreet', d.addressEntities.street)
  }
  set('doe', d.doe)
  const tParts = [cleanOcrValue(d.type), cleanOcrValue(d.typeNew)].filter(Boolean)
  if (tParts.length) n.cardType = tParts.join(' · ')
  set('issueDate', d.issueDate)
  set('issueLoc', d.issueLoc)
  set('religion', d.religion)
  set('ethnicity', d.ethnicity)
  set('features', d.features)
  return n
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const value = (error as { message?: unknown }).message
    if (typeof value === 'string' && value.trim().length > 0) return value
  }
  return fallback
}

export default function RegisterSellerScreen() {
  const router = useRouter()

  const [profile, setProfile] = useState<UserProfileResponse | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(true)

  const [form, setForm] = useState<SellerFormState>(INITIAL_FORM)
  const [step, setStep] = useState<Step>(1)
  const [submitting, setSubmitting] = useState(false)

  const [loadingLocations, setLoadingLocations] = useState(false)
  const [provinces, setProvinces] = useState<Province[]>([])
  const [districts, setDistricts] = useState<District[]>([])
  const [wards, setWards] = useState<Ward[]>([])

  const [docFiles, setDocFiles] = useState<Record<string, DocFile>>({})
  const [uploadingDocs, setUploadingDocs] = useState<Record<string, boolean>>({})

  const [idCardForm, setIdCardForm] = useState<IdCardFormState>(INITIAL_ID_CARD)
  const [ocrLoadingFront, setOcrLoadingFront] = useState(false)
  const [ocrLoadingBack, setOcrLoadingBack] = useState(false)
  const [ocrAnalyzing, setOcrAnalyzing] = useState(false)

  const [provinceSheetVisible, setProvinceSheetVisible] = useState(false)
  const [districtSheetVisible, setDistrictSheetVisible] = useState(false)
  const [wardSheetVisible, setWardSheetVisible] = useState(false)

  const docSlots = useMemo(() => getDocSlots(form.businessType), [form.businessType])
  const cccdSlots = useMemo(
    () => docSlots.filter((s) => s.docType === 'cccd_front' || s.docType === 'cccd_back'),
    [docSlots]
  )
  const businessDocSlots = useMemo(
    () => docSlots.filter((s) => s.docType !== 'cccd_front' && s.docType !== 'cccd_back'),
    [docSlots]
  )

  const selectedProvinceName = useMemo(
    () => provinces.find((p) => String(p.code) === form.provinceId)?.name ?? '',
    [provinces, form.provinceId]
  )

  const selectedDistrictName = useMemo(
    () => districts.find((d) => String(d.code) === form.districtId)?.name ?? '',
    [districts, form.districtId]
  )

  const selectedWardName = useMemo(
    () => wards.find((w) => String(w.code) === form.wardCode)?.name ?? '',
    [wards, form.wardCode]
  )

  useEffect(() => {
    const init = async () => {
      await Promise.all([loadProfile(), loadProvinces()])
    }
    init()
  }, [])

  const loadProfile = async () => {
    try {
      setLoadingProfile(true)
      const res = await profileService.getProfile()
      if (res.success && res.data) {
        setProfile(res.data)
        setForm((prev) => ({
          ...prev,
          phone: prev.phone || res.data.phone || '',
        }))
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể tải thông tin hồ sơ')
    } finally {
      setLoadingProfile(false)
    }
  }

  const loadProvinces = async () => {
    try {
      setLoadingLocations(true)
      const data = await vietnamProvincesService.getProvinces()
      setProvinces(data)
    } catch {
      Alert.alert('Lỗi', 'Không thể tải danh sách tỉnh/thành phố')
    } finally {
      setLoadingLocations(false)
    }
  }

  const handleProvinceChange = async (value: string) => {
    const provinceId = Number(value)
    const selected = provinces.find((p) => p.code === provinceId)

    setForm((prev) => ({
      ...prev,
      provinceId: value,
      city: selected?.name ?? '',
      districtId: '',
      wardCode: '',
    }))
    setDistricts([])
    setWards([])

    if (!provinceId) return

    try {
      setLoadingLocations(true)
      const data = await vietnamProvincesService.getDistricts(provinceId)
      setDistricts(data)
    } catch {
      Alert.alert('Lỗi', 'Không thể tải danh sách quận/huyện')
    } finally {
      setLoadingLocations(false)
    }
  }

  const handleDistrictChange = async (value: string) => {
    const districtId = Number(value)

    setForm((prev) => ({
      ...prev,
      districtId: value,
      wardCode: '',
    }))
    setWards([])

    if (!districtId) return

    try {
      setLoadingLocations(true)
      const data = await vietnamProvincesService.getWards(districtId)
      setWards(data)
    } catch {
      Alert.alert('Lỗi', 'Không thể tải danh sách phường/xã')
    } finally {
      setLoadingLocations(false)
    }
  }

  const pickDocFromLibrary = async (docType: string) => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Quyền truy cập', 'Cần cấp quyền thư viện ảnh để tải lên giấy tờ')
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.85,
      })

      if (result.canceled || !result.assets?.[0]) return

      const asset = result.assets[0]
      const mimeType = asset.mimeType ?? 'image/jpeg'

      if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
        Alert.alert('Lỗi', 'Chỉ hỗ trợ ảnh JPEG, PNG, WEBP')
        return
      }

      if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
        Alert.alert('Lỗi', 'Ảnh không được vượt quá 5 MB')
        return
      }

      setDocFiles((prev) => ({
        ...prev,
        [docType]: {
          uri: asset.uri,
          mimeType,
          fileSize: asset.fileSize,
          uploaded: false,
          fileUrl: '',
        },
      }))
      if (docType === 'cccd_front') {
        setIdCardForm((p) => clearFrontOcrPart(p))
      } else if (docType === 'cccd_back') {
        setIdCardForm((p) => clearBackOcrPart(p))
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể chọn ảnh')
    }
  }

  const runCccdOcr = async (
    side: 'front' | 'back',
    doc: DocFile,
  ): Promise<boolean> => {
    if (side === 'front') {
      setOcrLoadingFront(true)
      setIdCardForm((p) => clearFrontOcrPart(p))
    } else {
      setOcrLoadingBack(true)
      setIdCardForm((p) => clearBackOcrPart(p))
    }
    try {
      const res = await recognizeVietnamIdCard({
        uri: doc.uri,
        name: side === 'front' ? 'cccd_front.jpg' : 'cccd_back.jpg',
        type: doc.mimeType,
      })
      if (!res.success || !res.data) {
        Alert.alert('OCR', res.message ?? 'Không đọc được thông tin từ ảnh')
        return false
      }
      const d = res.data
      setIdCardForm((prev) => mergeOcrIntoIdForm(prev, d))
      if (d.address && side === 'front') {
        setForm((prev) => ({
          ...prev,
          addressLine: prev.addressLine.trim() ? prev.addressLine : d.address!,
        }))
      }
      return true
    } catch (e) {
      Alert.alert('Lỗi', getErrorMessage(e, 'Lỗi khi gọi dịch vụ đọc CCCD'))
      return false
    } finally {
      if (side === 'front') {
        setOcrLoadingFront(false)
      } else {
        setOcrLoadingBack(false)
      }
    }
  }

  const analyzeIdCards = async () => {
    const front = docFiles.cccd_front
    const back = docFiles.cccd_back
    if (!front && !back) {
      Alert.alert('Thiếu ảnh', 'Vui lòng chọn ảnh mặt trước và/hoặc mặt sau, rồi bấm phân tích')
      return
    }
    setOcrAnalyzing(true)
    try {
      let ok = true
      if (front) {
        const r = await runCccdOcr('front', front)
        if (!r) {
          ok = false
        }
      }
      if (back) {
        const r = await runCccdOcr('back', back)
        if (!r) {
          ok = false
        }
      }
      if (ok) {
        Alert.alert('Thành công', 'Đã phân tích xong — vui lòng kiểm tra nội dung bên dưới')
      }
    } finally {
      setOcrAnalyzing(false)
    }
  }

  const uploadDoc = async (docType: string, userId: string): Promise<string> => {
    const doc = docFiles[docType]
    if (!doc) throw new Error(`Chưa chọn file cho ${docType}`)
    if (doc.uploaded) return doc.fileUrl

    setUploadingDocs((prev) => ({ ...prev, [docType]: true }))
    try {
      const ext = doc.mimeType.split('/')[1] ?? 'jpg'
      const path = `shop-docs/${userId}/${Date.now()}_${docType}.${ext}`

      const response = await fetch(doc.uri)
      const arrayBuffer = await response.arrayBuffer()

      const { error } = await supabase.storage
        .from('image')
        .upload(path, arrayBuffer, {
          upsert: true,
          cacheControl: '0',
          contentType: doc.mimeType,
        })

      if (error) throw error

      const { data: pub } = supabase.storage.from('image').getPublicUrl(path)
      const fileUrl = pub.publicUrl

      setDocFiles((prev) => ({
        ...prev,
        [docType]: {
          ...prev[docType],
          uploaded: true,
          fileUrl,
        },
      }))

      return fileUrl
    } finally {
      setUploadingDocs((prev) => ({ ...prev, [docType]: false }))
    }
  }

  const validateStep = (targetStep: Step): boolean => {
    if (targetStep === 1) {
      if (!form.shopName.trim()) {
        Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên shop')
        return false
      }
      if (!form.businessType) {
        Alert.alert('Thiếu thông tin', 'Vui lòng chọn loại hình kinh doanh')
        return false
      }
    }

    if (targetStep === 2) {
      if (!form.phone.trim()) {
        Alert.alert('Thiếu thông tin', 'Vui lòng nhập số điện thoại shop')
        return false
      }
      const p = normalizeVietnamPhone(form.phone)
      if (!isVietnamPhoneLocal(p)) {
        Alert.alert('Số điện thoại', 'Số điện thoại shop không hợp lệ (đầu 0 hoặc +84, 9–10 số).')
        return false
      }
      if (!form.addressLine.trim()) {
        Alert.alert('Thiếu thông tin', 'Vui lòng nhập địa chỉ lấy hàng')
        return false
      }
      if (!form.provinceId) {
        Alert.alert('Thiếu thông tin', 'Vui lòng chọn tỉnh/thành phố')
        return false
      }
      if (!form.districtId) {
        Alert.alert('Thiếu thông tin', 'Vui lòng chọn quận/huyện')
        return false
      }
      if (!form.wardCode) {
        Alert.alert('Thiếu thông tin', 'Vui lòng chọn phường/xã')
        return false
      }
    }

    if (targetStep === 4) {
      if (!docFiles.cccd_front || !docFiles.cccd_back) {
        Alert.alert('Thiếu tài liệu', 'Vui lòng tải ảnh CCCD mặt trước và mặt sau')
        return false
      }
      if (!idCardForm.name.trim()) {
        Alert.alert(
          'Thiếu thông tin',
          'Vui lòng bấm "Phân tích căn cước" sau khi chọn ảnh để hệ thống điền họ tên từ CCCD (giống website).'
        )
        return false
      }
      const requiredSlots = businessDocSlots.filter((slot) => slot.required)
      for (const slot of requiredSlots) {
        if (!docFiles[slot.docType]) {
          Alert.alert('Thiếu tài liệu', `Vui lòng tải lên: ${slot.label}`)
          return false
        }
      }
    }

    return true
  }

  const nextStep = () => {
    if (!validateStep(step)) return
    if (step < 4) setStep((prev) => (prev + 1) as Step)
  }

  const prevStep = () => {
    if (step > 1) setStep((prev) => (prev - 1) as Step)
  }

  const handleSubmit = async () => {
    if (!validateStep(1) || !validateStep(2) || !validateStep(4)) return

    const provinceId = Number(form.provinceId)
    const districtId = Number(form.districtId)

    if (!Number.isInteger(provinceId) || provinceId <= 0) {
      Alert.alert('Lỗi', 'Province không hợp lệ')
      return
    }

    if (!Number.isInteger(districtId) || districtId <= 0) {
      Alert.alert('Lỗi', 'District không hợp lệ')
      return
    }

    const userId = profile?.id
    if (!userId) {
      Alert.alert('Lỗi', 'Không xác định được tài khoản')
      return
    }

    try {
      setSubmitting(true)

      const fileDocTypes = new Set(['business_license', 'tax_cert'])
      const documents: ShopDocumentInput[] = []
      for (const slot of docSlots) {
        if (!fileDocTypes.has(slot.docType)) continue
        if (!docFiles[slot.docType]) continue
        const fileUrl = await uploadDoc(slot.docType, userId)
        documents.push({ docType: slot.docType, fileUrl })
      }

      const identity: SellerIdentityInfo = {
        fullName: idCardForm.name.trim(),
        idNumber: idCardForm.idNumber.trim() || null,
        dateOfBirth: idCardForm.dob.trim() || null,
        sex: idCardForm.sex.trim() || null,
        nationality: idCardForm.nationality.trim() || null,
        homeTown: idCardForm.home.trim() || null,
        permanentAddress: idCardForm.address.trim() || null,
        addrProvince: idCardForm.addrProvince.trim() || null,
        addrDistrict: idCardForm.addrDistrict.trim() || null,
        addrWard: idCardForm.addrWard.trim() || null,
        addrStreet: idCardForm.addrStreet.trim() || null,
        dateOfExpiry: idCardForm.doe.trim() || null,
        cardType: idCardForm.cardType.trim() || null,
        issueDate: idCardForm.issueDate.trim() || null,
        issuePlace: idCardForm.issueLoc.trim() || null,
        religion: idCardForm.religion.trim() || null,
        ethnicity: idCardForm.ethnicity.trim() || null,
        features: idCardForm.features.trim() || null,
      }

      const payload: RegisterSellerRequest = {
        shopName: form.shopName.trim(),
        shopDescription: form.shopDescription.trim() || null,
        phone: normalizeVietnamPhone(form.phone),
        addressLine: form.addressLine.trim(),
        wardCode: form.wardCode,
        districtId,
        provinceId,
        city: form.city.trim(),
        businessLicenseNumber: form.businessLicenseNumber.trim() || null,
        taxCode: form.taxCode.trim() || null,
        businessType: form.businessType,
        bankName: form.bankName.trim() || null,
        bankAccountNumber: form.bankAccountNumber.trim() || null,
        bankAccountName: form.bankAccountName.trim() || null,
        identity,
        documents: documents.length > 0 ? documents : undefined,
      }

      const res = await profileService.registerSeller(payload)
      if (!res.success) {
        Alert.alert('Thất bại', res.message ?? 'Đăng ký seller thất bại')
        return
      }

      Alert.alert(
        'Thành công',
        res.message ?? 'Đăng ký seller thành công, vui lòng chờ admin duyệt',
        [{ text: 'OK', onPress: () => router.replace('/(tabs)/profile') }]
      )
    } catch (error: unknown) {
      Alert.alert('Lỗi', getErrorMessage(error, 'Có lỗi xảy ra khi gửi đăng ký'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loadingProfile) {
    return <Loading />
  }

  if (!profile || profile.role === 'seller' || profile.role === 'admin') {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Đăng ký Seller</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.notEligibleCard}>
          <Text style={styles.notEligibleTitle}>Tài khoản đã có quyền Seller hoặc Admin</Text>
          <Text style={styles.notEligibleText}>
            Bạn không cần tạo yêu cầu đăng ký seller mới.
          </Text>
          <Button
            title="Quay lại hồ sơ"
            onPress={() => router.replace('/(tabs)/profile')}
            fullWidth
          />
        </View>
      </View>
    )
  }

  if (profile.shop && profile.shop.verificationStatus === 0) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Đăng ký Seller</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.notEligibleCard}>
          <Text style={styles.notEligibleTitle}>Đang chờ xét duyệt</Text>
          <Text style={styles.notEligibleText}>
            Đơn đăng ký của bạn đã được gửi và đang chờ admin phê duyệt.
          </Text>
          <View style={styles.pendingInfoBox}>
            <Text style={styles.pendingInfoText}>
              Tên shop: {profile.shop.name || profile.shop.shopName || '-'}
            </Text>
            <Text style={styles.pendingInfoText}>Bạn sẽ nhận thông báo khi có kết quả.</Text>
          </View>
          <Button
            title="Quay lại hồ sơ"
            onPress={() => router.replace('/(tabs)/profile')}
            variant="outline"
            fullWidth
          />
        </View>
      </View>
    )
  }

  if (profile.shop && profile.shop.verificationStatus === 2) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Đăng ký Seller</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.notEligibleCard}>
          <Text style={styles.notEligibleTitle}>Đơn đăng ký bị từ chối</Text>
          <Text style={styles.notEligibleText}>
            Admin đã từ chối đơn đăng ký seller của bạn.
          </Text>
          {!!profile.shop.rejectionReason && (
            <View style={styles.rejectedInfoBox}>
              <Text style={styles.rejectedInfoTitle}>Lý do từ chối:</Text>
              <Text style={styles.rejectedInfoText}>{profile.shop.rejectionReason}</Text>
            </View>
          )}
          <View style={styles.pendingInfoBox}>
            <Text style={styles.pendingInfoText}>Bạn có thể chỉnh sửa thông tin và gửi lại đơn đăng ký.</Text>
          </View>
          <View style={styles.rejectedActionsRow}>
            <Button
              title="Quay lại hồ sơ"
              onPress={() => router.replace('/(tabs)/profile')}
              variant="outline"
              style={styles.rejectedActionBtn}
            />
            <Button
              title="Đăng ký lại"
              onPress={() => {
                setProfile((prev) => (prev ? { ...prev, shop: null } : prev))
                setIdCardForm(INITIAL_ID_CARD)
                setDocFiles({})
                setStep(1)
              }}
              style={styles.rejectedActionBtn}
            />
          </View>
        </View>
      </View>
    )
  }

  if (profile.shop && profile.shop.verificationStatus === 1) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Đăng ký Seller</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.notEligibleCard}>
          <Text style={styles.notEligibleTitle}>Cửa hàng đã được duyệt</Text>
          <Text style={styles.notEligibleText}>
            Tài khoản đã gắn shop đã phê duyệt. Nếu bạn vẫn thấy thông báo này, hãy đăng xuất và đăng nhập lại.
          </Text>
          <Button
            title="Quay lại hồ sơ"
            onPress={() => router.replace('/(tabs)/profile')}
            fullWidth
          />
        </View>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar style="dark" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Đăng ký trở thành Seller</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.subtitle}>
          Hoàn tất 4 bước để gửi yêu cầu duyệt. Sau khi admin duyệt, hệ thống sẽ tự tạo
          cửa hàng GHN.
        </Text>

        <View style={styles.stepRow}>
          {([1, 2, 3, 4] as Step[]).map((n) => (
            <View key={n} style={[styles.stepBadge, step === n ? styles.stepBadgeActive : undefined]}>
              <Text style={[styles.stepBadgeText, step === n ? styles.stepBadgeTextActive : undefined]}>
                Bước {n}: {STEP_LABELS[n]}
              </Text>
            </View>
          ))}
        </View>

        {step === 1 && (
          <View style={styles.card}>
            <Input
              label="Tên shop *"
              value={form.shopName}
              placeholder="Ví dụ: Handmade Home"
              onChangeText={(value) => setForm((prev) => ({ ...prev, shopName: value }))}
            />

            <Text style={styles.inputLabel}>Loại hình kinh doanh *</Text>
            <View style={styles.businessTypeRow}>
              {[
                { value: 'individual', label: 'Cá nhân' },
                { value: 'household', label: 'Hộ kinh doanh' },
                { value: 'company', label: 'Công ty' },
              ].map((item) => {
                const selected = form.businessType === item.value
                return (
                  <TouchableOpacity
                    key={item.value}
                    style={[styles.businessChip, selected ? styles.businessChipActive : undefined]}
                    onPress={() =>
                      setForm((prev) => ({
                        ...prev,
                        businessType: item.value as RegisterSellerRequest['businessType'],
                      }))
                    }
                  >
                    <Text
                      style={[
                        styles.businessChipText,
                        selected ? styles.businessChipTextActive : undefined,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            <Input
              label="Mô tả shop"
              value={form.shopDescription}
              placeholder="Mô tả ngắn về sản phẩm và thế mạnh của shop"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              onChangeText={(value) =>
                setForm((prev) => ({
                  ...prev,
                  shopDescription: value,
                }))
              }
              style={styles.textarea}
            />
          </View>
        )}

        {step === 2 && (
          <View style={styles.card}>
            <Input
              label="Số điện thoại shop *"
              value={form.phone}
              placeholder="09xxxxxxxx"
              keyboardType="phone-pad"
              onChangeText={(value) => setForm((prev) => ({ ...prev, phone: value }))}
            />

            <Input
              label="Địa chỉ lấy hàng *"
              value={form.addressLine}
              placeholder="Số nhà, tên đường"
              onChangeText={(value) => setForm((prev) => ({ ...prev, addressLine: value }))}
            />

            <SelectField
              label="Tỉnh/Thành phố *"
              value={selectedProvinceName}
              placeholder={loadingLocations ? 'Đang tải...' : 'Chọn Tỉnh/Thành phố'}
              onPress={() => setProvinceSheetVisible(true)}
            />

            <SelectField
              label="Quận/Huyện *"
              value={selectedDistrictName}
              placeholder={loadingLocations ? 'Đang tải...' : 'Chọn Quận/Huyện'}
              onPress={() => setDistrictSheetVisible(true)}
              disabled={!form.provinceId || loadingLocations}
            />

            <SelectField
              label="Phường/Xã *"
              value={selectedWardName}
              placeholder={loadingLocations ? 'Đang tải...' : 'Chọn Phường/Xã'}
              onPress={() => setWardSheetVisible(true)}
              disabled={!form.districtId || loadingLocations}
            />

            <Input label="Thành phố" value={form.city} editable={false} style={styles.readonlyInput} />
          </View>
        )}

        {step === 3 && (
          <View style={styles.card}>
            <Input
              label="Số giấy phép kinh doanh"
              value={form.businessLicenseNumber}
              placeholder="Tùy chọn"
              onChangeText={(value) =>
                setForm((prev) => ({
                  ...prev,
                  businessLicenseNumber: value,
                }))
              }
            />

            <Input
              label="Mã số thuế"
              value={form.taxCode}
              placeholder="Tùy chọn"
              onChangeText={(value) => setForm((prev) => ({ ...prev, taxCode: value }))}
            />

            <Input
              label="Ngân hàng"
              value={form.bankName}
              placeholder="Tùy chọn"
              onChangeText={(value) => setForm((prev) => ({ ...prev, bankName: value }))}
            />

            <Input
              label="Số tài khoản"
              value={form.bankAccountNumber}
              placeholder="Tùy chọn"
              onChangeText={(value) =>
                setForm((prev) => ({
                  ...prev,
                  bankAccountNumber: value,
                }))
              }
            />

            <Input
              label="Tên chủ tài khoản"
              value={form.bankAccountName}
              placeholder="Tùy chọn"
              onChangeText={(value) =>
                setForm((prev) => ({
                  ...prev,
                  bankAccountName: value,
                }))
              }
            />
          </View>
        )}

        {step === 4 && (
          <View style={styles.card}>
            <View style={styles.infoBanner}>
              <Ionicons name="document-text-outline" size={18} color={COLORS.primary} />
              <View style={styles.infoTextWrap}>
                <Text style={styles.infoTitle}>Xác minh danh tính (CCCD / CMND)</Text>
                <Text style={styles.infoText}>
                  Chọn ảnh mặt trước/mặt sau, sau đó bấm Phân tích căn cước. Hệ thống gọi dịch vụ đọc CCCD
                  qua server (FPT.AI) — dữ liệu hiển thị bên dưới để bạn kiểm tra, không sửa tay trên app.
                </Text>
              </View>
            </View>

            <View style={styles.docGrid}>
              {cccdSlots.map((slot) => {
                const doc = docFiles[slot.docType]
                const isUploading = uploadingDocs[slot.docType]
                const ocrWait =
                  slot.docType === 'cccd_front' ? ocrLoadingFront : slot.docType === 'cccd_back' ? ocrLoadingBack : false
                return (
                  <DocUploadCard
                    key={slot.docType}
                    slot={slot}
                    doc={doc}
                    isUploading={!!isUploading || ocrWait}
                    onPickFile={() => pickDocFromLibrary(slot.docType)}
                    onRemove={() => {
                      setDocFiles((prev) => {
                        const copy = { ...prev }
                        delete copy[slot.docType]
                        return copy
                      })
                    }}
                  />
                )
              })}
            </View>

            <View style={styles.ocrActionRow}>
              <Button
                title={ocrAnalyzing ? 'Đang phân tích...' : 'Phân tích căn cước'}
                onPress={analyzeIdCards}
                disabled={ocrAnalyzing}
                loading={ocrAnalyzing}
                fullWidth
              />
            </View>
            <Text style={styles.ocrActionHint}>
              Gọi sau khi chọn ảnh. Có cả mặt trước và mặt sau sẽ đọc cả hai (mặt trước trước, mặt sau sau).
            </Text>

            <Text style={styles.idSectionHint}>Thông tin trên CCCD/CMND (chỉ xem — từ OCR)</Text>
            <ReadOnlyField label="Họ và tên" value={idCardForm.name} />
            <ReadOnlyField label="Số CCCD/CMND" value={idCardForm.idNumber} />
            <ReadOnlyField label="Ngày sinh" value={idCardForm.dob} />
            <ReadOnlyField label="Giới tính" value={idCardForm.sex} />
            <ReadOnlyField label="Quốc tịch" value={idCardForm.nationality} />
            <ReadOnlyField label="Quê quán" value={idCardForm.home} multiline />
            <ReadOnlyField label="Nơi thường trú" value={idCardForm.address} multiline />
            <Text style={styles.idSectionHint}>Mặt sau / chi tiết</Text>
            <ReadOnlyField label="Loại thẻ" value={idCardForm.cardType} />
            <ReadOnlyField label="Ngày cấp" value={idCardForm.issueDate} />
            <ReadOnlyField label="Nơi cấp" value={idCardForm.issueLoc} multiline />
            <ReadOnlyField label="Hạn thẻ" value={idCardForm.doe} />
            <ReadOnlyField label="Tôn giáo" value={idCardForm.religion} />
            <ReadOnlyField label="Dân tộc" value={idCardForm.ethnicity} />
            <ReadOnlyField label="Đặc điểm nhận dạng" value={idCardForm.features} multiline />

            {businessDocSlots.length > 0 && (
              <>
                <Text style={styles.idSectionHint}>Hồ sơ kinh doanh (bắt buộc với hộ / công ty)</Text>
                <View style={styles.docGrid}>
                  {businessDocSlots.map((slot) => {
                    const doc = docFiles[slot.docType]
                    const isUploading = uploadingDocs[slot.docType]
                    return (
                      <DocUploadCard
                        key={slot.docType}
                        slot={slot}
                        doc={doc}
                        isUploading={isUploading}
                        onPickFile={() => pickDocFromLibrary(slot.docType)}
                        onRemove={() => {
                          setDocFiles((prev) => {
                            const copy = { ...prev }
                            delete copy[slot.docType]
                            return copy
                          })
                        }}
                      />
                    )
                  })}
                </View>
              </>
            )}

            <View style={styles.summaryBox}>
              <Text style={styles.summaryTitle}>Tóm tắt:</Text>
              <Text style={styles.summaryText}>Shop: {form.shopName || '-'}</Text>
              <Text style={styles.summaryText}>Loại hình: {form.businessType}</Text>
              <Text style={styles.summaryText}>Họ tên CCCD: {idCardForm.name || '(chưa phân tích)'}</Text>
              <Text style={styles.summaryText}>
                Địa chỉ GHN: {form.addressLine || '-'}
                {selectedWardName ? `, ${selectedWardName}` : ''}
                {selectedDistrictName ? `, ${selectedDistrictName}` : ''}
                {form.city ? `, ${form.city}` : ''}
              </Text>
              <Text style={styles.summaryText}>
                CCCD:{' '}
                {cccdSlots
                  .map((s) =>
                    docFiles[s.docType] ? `OK ${s.label}` : `Thiếu ${s.label}${s.required ? ' (bắt buộc)' : ''}`
                  )
                  .join(' | ')}
              </Text>
              {businessDocSlots.length > 0 ? (
                <Text style={styles.summaryText}>
                  Hồ sơ KD:{' '}
                  {businessDocSlots
                    .map((s) =>
                      docFiles[s.docType]
                        ? `OK ${s.label}`
                        : `Thiếu ${s.label}${s.required ? ' (bắt buộc)' : ''}`
                    )
                    .join(' | ')}
                </Text>
              ) : null}
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title={step === 1 ? 'Quay lại hồ sơ' : 'Quay lại'}
          variant="outline"
          onPress={step === 1 ? () => router.replace('/(tabs)/profile') : prevStep}
          disabled={submitting}
          style={styles.footerBtn}
        />

        {step < 4 ? (
          <Button title="Tiếp tục" onPress={nextStep} style={styles.footerBtn} />
        ) : (
          <Button
            title={submitting ? 'Đang gửi...' : 'Gửi yêu cầu duyệt'}
            onPress={handleSubmit}
            disabled={submitting}
            loading={submitting}
            style={styles.footerBtn}
          />
        )}
      </View>

      <SelectSheet
        title="Chọn Tỉnh/Thành phố"
        visible={provinceSheetVisible}
        onClose={() => setProvinceSheetVisible(false)}
        options={provinces.map((p) => ({ value: String(p.code), label: p.name }))}
        selectedValue={form.provinceId}
        onSelect={async (value) => {
          setProvinceSheetVisible(false)
          await handleProvinceChange(value)
        }}
      />

      <SelectSheet
        title="Chọn Quận/Huyện"
        visible={districtSheetVisible}
        onClose={() => setDistrictSheetVisible(false)}
        options={districts.map((d) => ({ value: String(d.code), label: d.name }))}
        selectedValue={form.districtId}
        onSelect={async (value) => {
          setDistrictSheetVisible(false)
          await handleDistrictChange(value)
        }}
      />

      <SelectSheet
        title="Chọn Phường/Xã"
        visible={wardSheetVisible}
        onClose={() => setWardSheetVisible(false)}
        options={wards.map((w) => ({ value: String(w.code), label: w.name }))}
        selectedValue={form.wardCode}
        onSelect={(value) => {
          setWardSheetVisible(false)
          setForm((prev) => ({ ...prev, wardCode: value }))
        }}
      />
    </KeyboardAvoidingView>
  )
}

type ReadOnlyFieldProps = {
  label: string
  value: string
  multiline?: boolean
}

function ReadOnlyField({ label, value, multiline }: ReadOnlyFieldProps) {
  return (
    <View style={styles.readOnlyField}>
      <Text style={styles.readOnlyLabel}>{label}</Text>
      <Text
        style={[styles.readOnlyValue, multiline ? styles.readOnlyValueMulti : undefined]}
        numberOfLines={multiline ? 12 : 2}
      >
        {value.trim() || '—'}
      </Text>
    </View>
  )
}

type SelectFieldProps = {
  label: string
  value: string
  placeholder: string
  onPress: () => void
  disabled?: boolean
}

function SelectField({ label, value, placeholder, onPress, disabled }: SelectFieldProps) {
  return (
    <View style={styles.selectFieldWrap}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.7}
        style={[styles.selectField, disabled ? styles.selectFieldDisabled : undefined]}
      >
        <Text style={[styles.selectFieldText, !value ? styles.selectPlaceholder : undefined]}>
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={COLORS.textSecondary} />
      </TouchableOpacity>
    </View>
  )
}

type SelectOption = {
  value: string
  label: string
}

type SelectSheetProps = {
  title: string
  visible: boolean
  onClose: () => void
  options: SelectOption[]
  selectedValue: string
  onSelect: (value: string) => void | Promise<void>
}

function SelectSheet({ title, visible, onClose, options, selectedValue, onSelect }: SelectSheetProps) {
  return (
    <BottomSheet visible={visible} title={title} onClose={onClose} height={420}>
      {options.length === 0 ? (
        <Text style={styles.emptySelectText}>Chưa có dữ liệu</Text>
      ) : (
        <View style={styles.selectList}>
          {options.map((option) => {
            const isSelected = selectedValue === option.value
            return (
              <TouchableOpacity
                key={option.value}
                style={[styles.selectItem, isSelected ? styles.selectItemSelected : undefined]}
                onPress={() => onSelect(option.value)}
              >
                <Text style={[styles.selectItemText, isSelected ? styles.selectItemTextSelected : undefined]}>
                  {option.label}
                </Text>
                {isSelected && <Ionicons name="checkmark" size={16} color={COLORS.primary} />}
              </TouchableOpacity>
            )
          })}
        </View>
      )}
    </BottomSheet>
  )
}

type DocUploadCardProps = {
  slot: DocSlot
  doc: DocFile | undefined
  isUploading: boolean | undefined
  onPickFile: () => void
  onRemove: () => void
}

function DocUploadCard({ slot, doc, isUploading, onPickFile, onRemove }: DocUploadCardProps) {
  return (
    <View style={styles.docCard}>
      <View style={styles.docHeader}>
        <Text style={styles.docTitle}>
          {slot.label}
          {slot.required && <Text style={styles.requiredMark}> *</Text>}
        </Text>
        {doc && (
          <TouchableOpacity onPress={onRemove}>
            <Ionicons name="close" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {doc ? (
        <View style={styles.previewWrap}>
          <Image source={{ uri: doc.uri }} style={styles.previewImage} />
          {isUploading && (
            <View style={styles.uploadingOverlay}>
              <ActivityIndicator size="small" color={COLORS.onPrimary} />
              <Text style={styles.uploadingText}>Đang tải lên...</Text>
            </View>
          )}
          {doc.uploaded && (
            <View style={styles.uploadedBadge}>
              <Ionicons name="checkmark" size={14} color={COLORS.onPrimary} />
            </View>
          )}
        </View>
      ) : (
        <TouchableOpacity style={styles.emptyDoc} onPress={onPickFile} activeOpacity={0.7}>
          <Ionicons name="image-outline" size={30} color={COLORS.textSecondary} />
          <Text style={styles.emptyDocHint}>{slot.hint}</Text>
          <Text style={styles.emptyDocMeta}>JPEG | PNG | WEBP | tối đa 5 MB</Text>
        </TouchableOpacity>
      )}

      {doc && (
        <TouchableOpacity style={styles.replaceBtn} onPress={onPickFile} activeOpacity={0.7}>
          <Ionicons name="camera-outline" size={15} color={COLORS.primary} />
          <Text style={styles.replaceText}>Đổi ảnh</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: SIZES.lg,
    paddingTop: SIZES.xxl + 10,
    paddingBottom: SIZES.lg,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FONTS.size.lg,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    flex: 1,
    marginHorizontal: SIZES.sm,
  },
  placeholder: {
    width: 36,
    height: 36,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: SIZES.lg,
    paddingBottom: SIZES.xl,
  },
  subtitle: {
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: SIZES.md,
  },
  stepRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SIZES.sm,
    marginBottom: SIZES.md,
  },
  stepBadge: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: SIZES.sm,
    paddingVertical: 6,
    backgroundColor: COLORS.card,
  },
  stepBadgeActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  stepBadgeText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  stepBadgeTextActive: {
    color: COLORS.onPrimary,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SIZES.md,
    marginBottom: SIZES.md,
  },
  inputLabel: {
    fontSize: FONTS.size.sm,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SIZES.xs,
  },
  textarea: {
    minHeight: 90,
  },
  businessTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SIZES.sm,
    marginBottom: SIZES.md,
  },
  businessChip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    backgroundColor: COLORS.background,
  },
  businessChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '15',
  },
  businessChipText: {
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  businessChipTextActive: {
    color: COLORS.primary,
  },
  selectFieldWrap: {
    marginBottom: SIZES.md,
  },
  selectField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.md,
  },
  selectFieldDisabled: {
    opacity: 0.5,
  },
  selectFieldText: {
    fontSize: FONTS.size.md,
    color: COLORS.text,
    flex: 1,
    marginRight: SIZES.sm,
  },
  selectPlaceholder: {
    color: COLORS.placeholder,
  },
  readonlyInput: {
    backgroundColor: COLORS.background,
    color: COLORS.textSecondary,
  },
  infoBanner: {
    borderWidth: 1,
    borderColor: '#d4b896',
    backgroundColor: '#fdf8f3',
    borderRadius: 12,
    padding: SIZES.md,
    flexDirection: 'row',
    gap: SIZES.sm,
    marginBottom: SIZES.md,
  },
  infoTextWrap: {
    flex: 1,
  },
  infoTitle: {
    fontSize: FONTS.size.sm,
    fontWeight: '700',
    color: COLORS.text,
  },
  infoText: {
    marginTop: 2,
    fontSize: FONTS.size.xs,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  idSectionHint: {
    fontSize: FONTS.size.xs,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: SIZES.sm,
    marginBottom: SIZES.xs,
  },
  ocrActionRow: {
    marginTop: SIZES.md,
  },
  ocrActionHint: {
    fontSize: FONTS.size.xs,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginTop: SIZES.sm,
    marginBottom: SIZES.sm,
  },
  readOnlyField: {
    marginBottom: SIZES.md,
  },
  readOnlyLabel: {
    fontSize: FONTS.size.xs,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  readOnlyValue: {
    fontSize: FONTS.size.md,
    color: COLORS.text,
    lineHeight: 22,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
  },
  readOnlyValueMulti: {
    minHeight: 56,
  },
  docGrid: {
    gap: SIZES.md,
  },
  docCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.card,
  },
  docHeader: {
    backgroundColor: '#fdf8f3',
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  docTitle: {
    fontSize: FONTS.size.sm,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
    paddingRight: SIZES.sm,
  },
  requiredMark: {
    color: COLORS.error,
  },
  previewWrap: {
    position: 'relative',
    height: 180,
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SIZES.xs,
  },
  uploadingText: {
    color: COLORS.onPrimary,
    fontSize: FONTS.size.xs,
  },
  uploadedBadge: {
    position: 'absolute',
    top: SIZES.sm,
    right: SIZES.sm,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyDoc: {
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SIZES.xs,
    paddingHorizontal: SIZES.md,
  },
  emptyDocHint: {
    textAlign: 'center',
    fontSize: FONTS.size.xs,
    color: COLORS.textSecondary,
  },
  emptyDocMeta: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  replaceBtn: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingVertical: SIZES.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: SIZES.xs,
  },
  replaceText: {
    color: COLORS.primary,
    fontWeight: '600',
    fontSize: FONTS.size.xs,
  },
  summaryBox: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: SIZES.md,
    marginTop: SIZES.md,
    backgroundColor: COLORS.background,
  },
  summaryTitle: {
    fontSize: FONTS.size.sm,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SIZES.xs,
  },
  summaryText: {
    fontSize: FONTS.size.xs,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.card,
    paddingHorizontal: SIZES.md,
    paddingTop: SIZES.sm,
    paddingBottom: SIZES.md,
    flexDirection: 'row',
    gap: SIZES.sm,
  },
  footerBtn: {
    flex: 1,
  },
  selectList: {
    gap: SIZES.xs,
  },
  selectItem: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.card,
  },
  selectItemSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  selectItemText: {
    fontSize: FONTS.size.sm,
    color: COLORS.text,
    flex: 1,
    paddingRight: SIZES.sm,
  },
  selectItemTextSelected: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  emptySelectText: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    paddingVertical: SIZES.lg,
  },
  pendingInfoBox: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    backgroundColor: COLORS.background,
    padding: SIZES.md,
    gap: SIZES.xs,
    marginBottom: SIZES.sm,
  },
  pendingInfoText: {
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  rejectedInfoBox: {
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 10,
    backgroundColor: '#fff5f5',
    padding: SIZES.md,
    gap: SIZES.xs,
    marginBottom: SIZES.sm,
  },
  rejectedInfoTitle: {
    fontSize: FONTS.size.sm,
    fontWeight: '700',
    color: '#b91c1c',
  },
  rejectedInfoText: {
    fontSize: FONTS.size.sm,
    color: '#dc2626',
    lineHeight: 20,
  },
  rejectedActionsRow: {
    flexDirection: 'row',
    gap: SIZES.sm,
    marginTop: SIZES.xs,
  },
  rejectedActionBtn: {
    flex: 1,
  },
  notEligibleCard: {
    margin: SIZES.lg,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: SIZES.lg,
    gap: SIZES.sm,
  },
  notEligibleTitle: {
    fontSize: FONTS.size.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  notEligibleText: {
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
    marginBottom: SIZES.sm,
    lineHeight: 20,
  },
})
