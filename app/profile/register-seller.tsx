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
import type {
  RegisterSellerRequest,
  ShopDocumentInput,
  UserProfileResponse,
} from '@/types/profile'

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
  1: 'Thong tin shop',
  2: 'Dia chi lay hang',
  3: 'Ho so doanh nghiep',
  4: 'Xac minh danh tinh',
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

const DOC_SLOTS_BASE: DocSlot[] = [
  {
    docType: 'cccd_front',
    label: 'CCCD / CMND mat truoc',
    required: true,
    hint: 'Anh ro rang, khong bi che khuat',
  },
  {
    docType: 'cccd_back',
    label: 'CCCD / CMND mat sau',
    required: true,
    hint: 'Anh ro rang, khong bi che khuat',
  },
]

const DOC_SLOT_BUSINESS: DocSlot = {
  docType: 'business_license',
  label: 'Giay phep kinh doanh',
  required: true,
  hint: 'Bat buoc voi ho kinh doanh va cong ty',
}

function getDocSlots(businessType: string): DocSlot[] {
  const slots = [...DOC_SLOTS_BASE]
  if (businessType === 'company' || businessType === 'household') {
    slots.push(DOC_SLOT_BUSINESS)
  }
  return slots
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

  const [provinceSheetVisible, setProvinceSheetVisible] = useState(false)
  const [districtSheetVisible, setDistrictSheetVisible] = useState(false)
  const [wardSheetVisible, setWardSheetVisible] = useState(false)

  const docSlots = useMemo(() => getDocSlots(form.businessType), [form.businessType])

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
      Alert.alert('Loi', 'Khong the tai thong tin ho so')
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
      Alert.alert('Loi', 'Khong the tai danh sach tinh/thanh pho')
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
      Alert.alert('Loi', 'Khong the tai danh sach quan/huyen')
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
      Alert.alert('Loi', 'Khong the tai danh sach phuong/xa')
    } finally {
      setLoadingLocations(false)
    }
  }

  const pickDocFromLibrary = async (docType: string) => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Quyen truy cap', 'Can cap quyen thu vien anh de tai len giay to')
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
        Alert.alert('Loi', 'Chi ho tro anh JPEG, PNG, WEBP')
        return
      }

      if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
        Alert.alert('Loi', 'Anh khong duoc vuot qua 5 MB')
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
    } catch {
      Alert.alert('Loi', 'Khong the chon anh')
    }
  }

  const uploadDoc = async (docType: string, userId: string): Promise<string> => {
    const doc = docFiles[docType]
    if (!doc) throw new Error(`Chua chon file cho ${docType}`)
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
        Alert.alert('Thieu thong tin', 'Vui long nhap ten shop')
        return false
      }
      if (!form.businessType) {
        Alert.alert('Thieu thong tin', 'Vui long chon loai hinh kinh doanh')
        return false
      }
    }

    if (targetStep === 2) {
      if (!form.phone.trim()) {
        Alert.alert('Thieu thong tin', 'Vui long nhap so dien thoai shop')
        return false
      }
      if (!form.addressLine.trim()) {
        Alert.alert('Thieu thong tin', 'Vui long nhap dia chi lay hang')
        return false
      }
      if (!form.provinceId) {
        Alert.alert('Thieu thong tin', 'Vui long chon tinh/thanh pho')
        return false
      }
      if (!form.districtId) {
        Alert.alert('Thieu thong tin', 'Vui long chon quan/huyen')
        return false
      }
      if (!form.wardCode) {
        Alert.alert('Thieu thong tin', 'Vui long chon phuong/xa')
        return false
      }
    }

    if (targetStep === 4) {
      const requiredSlots = docSlots.filter((slot) => slot.required)
      for (const slot of requiredSlots) {
        if (!docFiles[slot.docType]) {
          Alert.alert('Thieu tai lieu', `Vui long tai len: ${slot.label}`)
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
      Alert.alert('Loi', 'Province khong hop le')
      return
    }

    if (!Number.isInteger(districtId) || districtId <= 0) {
      Alert.alert('Loi', 'District khong hop le')
      return
    }

    const userId = profile?.id
    if (!userId) {
      Alert.alert('Loi', 'Khong xac dinh duoc tai khoan')
      return
    }

    try {
      setSubmitting(true)

      const documents: ShopDocumentInput[] = []
      for (const slot of docSlots) {
        if (!docFiles[slot.docType]) continue
        const fileUrl = await uploadDoc(slot.docType, userId)
        documents.push({ docType: slot.docType, fileUrl })
      }

      const payload: RegisterSellerRequest = {
        shopName: form.shopName.trim(),
        shopDescription: form.shopDescription.trim() || null,
        phone: form.phone.trim(),
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
        documents,
      }

      const res = await profileService.registerSeller(payload)
      if (!res.success) {
        Alert.alert('That bai', res.message ?? 'Dang ky seller that bai')
        return
      }

      Alert.alert(
        'Thanh cong',
        res.message ?? 'Dang ky seller thanh cong, vui long cho admin duyet',
        [{ text: 'OK', onPress: () => router.replace('/(tabs)/profile') }]
      )
    } catch (error: unknown) {
      Alert.alert('Loi', getErrorMessage(error, 'Co loi xay ra khi gui dang ky'))
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
          <Text style={styles.headerTitle}>Dang ky Seller</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.notEligibleCard}>
          <Text style={styles.notEligibleTitle}>Tai khoan da co quyen Seller hoac Admin</Text>
          <Text style={styles.notEligibleText}>
            Ban khong can tao yeu cau dang ky seller moi.
          </Text>
          <Button
            title="Quay lai ho so"
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
          <Text style={styles.headerTitle}>Dang ky Seller</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.notEligibleCard}>
          <Text style={styles.notEligibleTitle}>Dang cho xet duyet</Text>
          <Text style={styles.notEligibleText}>
            Don dang ky cua ban da duoc gui va dang cho admin phe duyet.
          </Text>
          <View style={styles.pendingInfoBox}>
            <Text style={styles.pendingInfoText}>
              Ten shop: {profile.shop.name || profile.shop.shopName || '-'}
            </Text>
            <Text style={styles.pendingInfoText}>Ban se nhan thong bao khi co ket qua.</Text>
          </View>
          <Button
            title="Quay lai ho so"
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
          <Text style={styles.headerTitle}>Dang ky Seller</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.notEligibleCard}>
          <Text style={styles.notEligibleTitle}>Don dang ky bi tu choi</Text>
          <Text style={styles.notEligibleText}>
            Admin da tu choi don dang ky seller cua ban.
          </Text>
          {!!profile.shop.rejectionReason && (
            <View style={styles.rejectedInfoBox}>
              <Text style={styles.rejectedInfoTitle}>Ly do tu choi:</Text>
              <Text style={styles.rejectedInfoText}>{profile.shop.rejectionReason}</Text>
            </View>
          )}
          <View style={styles.pendingInfoBox}>
            <Text style={styles.pendingInfoText}>Ban co the chinh sua thong tin va gui lai don dang ky.</Text>
          </View>
          <View style={styles.rejectedActionsRow}>
            <Button
              title="Quay lai ho so"
              onPress={() => router.replace('/(tabs)/profile')}
              variant="outline"
              style={styles.rejectedActionBtn}
            />
            <Button
              title="Dang ky lai"
              onPress={() => {
                setProfile((prev) => (prev ? { ...prev, shop: null } : prev))
                setStep(1)
              }}
              style={styles.rejectedActionBtn}
            />
          </View>
        </View>
      </View>
    )
  }

  if (profile.shop) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Dang ky Seller</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.notEligibleCard}>
          <Text style={styles.notEligibleTitle}>Tai khoan hien tai khong can dang ky</Text>
          <Text style={styles.notEligibleText}>
            Tai khoan hien tai khong can thuc hien dang ky seller moi.
          </Text>
          <Button
            title="Quay lai ho so"
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
        <Text style={styles.headerTitle}>Dang ky tro thanh Seller</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.subtitle}>
          Hoan tat 4 buoc de gui yeu cau duyet. Sau khi admin duyet, he thong se tu tao
          cua hang GHN.
        </Text>

        <View style={styles.stepRow}>
          {([1, 2, 3, 4] as Step[]).map((n) => (
            <View key={n} style={[styles.stepBadge, step === n ? styles.stepBadgeActive : undefined]}>
              <Text style={[styles.stepBadgeText, step === n ? styles.stepBadgeTextActive : undefined]}>
                Buoc {n}: {STEP_LABELS[n]}
              </Text>
            </View>
          ))}
        </View>

        {step === 1 && (
          <View style={styles.card}>
            <Input
              label="Ten shop *"
              value={form.shopName}
              placeholder="Vi du: Handmade Home"
              onChangeText={(value) => setForm((prev) => ({ ...prev, shopName: value }))}
            />

            <Text style={styles.inputLabel}>Loai hinh kinh doanh *</Text>
            <View style={styles.businessTypeRow}>
              {[
                { value: 'individual', label: 'Ca nhan' },
                { value: 'household', label: 'Ho kinh doanh' },
                { value: 'company', label: 'Cong ty' },
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
              label="Mo ta shop"
              value={form.shopDescription}
              placeholder="Mo ta ngan ve san pham va the manh cua shop"
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
              label="So dien thoai shop *"
              value={form.phone}
              placeholder="09xxxxxxxx"
              keyboardType="phone-pad"
              onChangeText={(value) => setForm((prev) => ({ ...prev, phone: value }))}
            />

            <Input
              label="Dia chi lay hang *"
              value={form.addressLine}
              placeholder="So nha, ten duong"
              onChangeText={(value) => setForm((prev) => ({ ...prev, addressLine: value }))}
            />

            <SelectField
              label="Tinh/Thanh pho *"
              value={selectedProvinceName}
              placeholder={loadingLocations ? 'Dang tai...' : 'Chon Tinh/Thanh pho'}
              onPress={() => setProvinceSheetVisible(true)}
            />

            <SelectField
              label="Quan/Huyen *"
              value={selectedDistrictName}
              placeholder={loadingLocations ? 'Dang tai...' : 'Chon Quan/Huyen'}
              onPress={() => setDistrictSheetVisible(true)}
              disabled={!form.provinceId || loadingLocations}
            />

            <SelectField
              label="Phuong/Xa *"
              value={selectedWardName}
              placeholder={loadingLocations ? 'Dang tai...' : 'Chon Phuong/Xa'}
              onPress={() => setWardSheetVisible(true)}
              disabled={!form.districtId || loadingLocations}
            />

            <Input label="Thanh pho" value={form.city} editable={false} style={styles.readonlyInput} />
          </View>
        )}

        {step === 3 && (
          <View style={styles.card}>
            <Input
              label="So giay phep kinh doanh"
              value={form.businessLicenseNumber}
              placeholder="Tuy chon"
              onChangeText={(value) =>
                setForm((prev) => ({
                  ...prev,
                  businessLicenseNumber: value,
                }))
              }
            />

            <Input
              label="Ma so thue"
              value={form.taxCode}
              placeholder="Tuy chon"
              onChangeText={(value) => setForm((prev) => ({ ...prev, taxCode: value }))}
            />

            <Input
              label="Ngan hang"
              value={form.bankName}
              placeholder="Tuy chon"
              onChangeText={(value) => setForm((prev) => ({ ...prev, bankName: value }))}
            />

            <Input
              label="So tai khoan"
              value={form.bankAccountNumber}
              placeholder="Tuy chon"
              onChangeText={(value) =>
                setForm((prev) => ({
                  ...prev,
                  bankAccountNumber: value,
                }))
              }
            />

            <Input
              label="Ten chu tai khoan"
              value={form.bankAccountName}
              placeholder="Tuy chon"
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
              <Ionicons name="information-circle-outline" size={18} color={COLORS.primary} />
              <View style={styles.infoTextWrap}>
                <Text style={styles.infoTitle}>Ho so xac minh danh tinh</Text>
                <Text style={styles.infoText}>
                  Anh duoc luu tru bao mat va chi dung de xet duyet. Yeu cau anh ro net, du anh
                  sang, khong bi cat xen.
                </Text>
              </View>
            </View>

            <View style={styles.docGrid}>
              {docSlots.map((slot) => {
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

            <View style={styles.summaryBox}>
              <Text style={styles.summaryTitle}>Thong tin se gui:</Text>
              <Text style={styles.summaryText}>Shop: {form.shopName || '-'}</Text>
              <Text style={styles.summaryText}>Loai hinh: {form.businessType}</Text>
              <Text style={styles.summaryText}>
                Dia chi GHN: {form.addressLine || '-'}
                {selectedWardName ? `, ${selectedWardName}` : ''}
                {selectedDistrictName ? `, ${selectedDistrictName}` : ''}
                {form.city ? `, ${form.city}` : ''}
              </Text>
              <Text style={styles.summaryText}>
                Tai lieu:{' '}
                {docSlots
                  .map((s) =>
                    docFiles[s.docType]
                      ? `OK ${s.label}`
                      : `Thieu ${s.label}${s.required ? ' (bat buoc)' : ''}`
                  )
                  .join(' | ')}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title={step === 1 ? 'Quay lai ho so' : 'Quay lai'}
          variant="outline"
          onPress={step === 1 ? () => router.replace('/(tabs)/profile') : prevStep}
          disabled={submitting}
          style={styles.footerBtn}
        />

        {step < 4 ? (
          <Button title="Tiep tuc" onPress={nextStep} style={styles.footerBtn} />
        ) : (
          <Button
            title={submitting ? 'Dang gui...' : 'Gui yeu cau duyet'}
            onPress={handleSubmit}
            disabled={submitting}
            loading={submitting}
            style={styles.footerBtn}
          />
        )}
      </View>

      <SelectSheet
        title="Chon Tinh/Thanh pho"
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
        title="Chon Quan/Huyen"
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
        title="Chon Phuong/Xa"
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
        <Text style={styles.emptySelectText}>Chua co du lieu</Text>
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
              <Text style={styles.uploadingText}>Dang tai len...</Text>
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
          <Text style={styles.emptyDocMeta}>JPEG | PNG | WEBP | toi da 5 MB</Text>
        </TouchableOpacity>
      )}

      {doc && (
        <TouchableOpacity style={styles.replaceBtn} onPress={onPickFile} activeOpacity={0.7}>
          <Ionicons name="camera-outline" size={15} color={COLORS.primary} />
          <Text style={styles.replaceText}>Doi anh</Text>
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
