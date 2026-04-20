import React, { useEffect, useState, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  ActivityIndicator,
  ScrollView,
} from 'react-native'
import { useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Ionicons } from '@expo/vector-icons'
import { userService } from '@/services/user-service'
import { Address } from '@/types/user'
import Button from '@/components/Button'
import Loading from '@/components/Loading'
import { COLORS, SIZES, FONTS } from '@/constants/theme'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  vietnamProvincesService,
  Province,
  District,
  Ward,
} from '@/services/vietnam-provinces'

interface AddressForm {
  fullName: string
  phone: string
  addressLine1: string
  label: string
  isDefault: boolean
}

export default function AddressesScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [addresses, setAddresses] = useState<Address[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // --- Form Modal State ---
  const [formVisible, setFormVisible] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  
  const [form, setForm] = useState<AddressForm>({
    fullName: '',
    phone: '',
    addressLine1: '',
    label: '',
    isDefault: false,
  })

  // Location details selection
  const [selectedProvince, setSelectedProvince] = useState<Province | null>(null)
  const [selectedDistrict, setSelectedDistrict] = useState<District | null>(null)
  const [selectedWard, setSelectedWard] = useState<Ward | null>(null)
  const [phoneError, setPhoneError] = useState('')

  // --- Location Picker Modal State ---
  const [pickerVisible, setPickerVisible] = useState(false)
  const [pickerTab, setPickerTab] = useState<'province' | 'district' | 'ward'>('province')
  const [locationSearch, setLocationSearch] = useState('')
  
  const [provinces, setProvinces] = useState<Province[]>([])
  const [districts, setDistricts] = useState<District[]>([])
  const [wards, setWards] = useState<Ward[]>([])
  
  const [loadingProvinces, setLoadingProvinces] = useState(false)
  const [loadingDistricts, setLoadingDistricts] = useState(false)
  const [loadingWards, setLoadingWards] = useState(false)

  const loadAddresses = async () => {
    try {
      const response = await userService.getAddresses()
      if (response.success && response.data) {
        setAddresses(response.data)
      }
    } catch (error: any) {
      console.error('Failed to load addresses:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const loadProvinces = async () => {
    try {
      setLoadingProvinces(true)
      const data = await vietnamProvincesService.getProvinces()
      setProvinces(data)
    } catch {
      // suppress
    } finally {
      setLoadingProvinces(false)
    }
  }

  useEffect(() => {
    loadAddresses()
    loadProvinces()
  }, [])

  const onRefresh = () => {
    setRefreshing(true)
    loadAddresses()
  }

  // Formatting & Validation
  const validatePhone = (value: string) => {
    if (!value.trim()) {
      setPhoneError('')
      return true
    }
    const phoneRegex = /^(0|\+84)[0-9]{9,10}$/
    if (!phoneRegex.test(value.trim())) {
      setPhoneError('Số điện thoại không hợp lệ')
      return false
    } else {
      setPhoneError('')
      return true
    }
  }

  const openAddForm = () => {
    setEditingId(null)
    setForm({ fullName: '', phone: '', addressLine1: '', label: '', isDefault: false })
    setSelectedProvince(null)
    setSelectedDistrict(null)
    setSelectedWard(null)
    setDistricts([])
    setWards([])
    setPhoneError('')
    setFormVisible(true)
  }

  const openEditForm = async (addr: Address) => {
    setEditingId(addr.id)
    setForm({
      fullName: addr.fullName || '',
      phone: addr.phone || '',
      addressLine1: addr.addressLine1 || '',
      label: addr.label || '',
      isDefault: addr.isDefault,
    })
    setPhoneError('')

    // Try to restore location from 3rd-party mapping based on name
    const matchedProv = provinces.find((p) => p.name === addr.city)
    if (matchedProv) {
      setSelectedProvince(matchedProv)
      try {
        const dList = await vietnamProvincesService.getDistricts(matchedProv.code)
        setDistricts(dList)
        const matchedDist = dList.find((d) => d.name === addr.district)
        if (matchedDist) {
          setSelectedDistrict(matchedDist)
          const wList = await vietnamProvincesService.getWards(matchedDist.code)
          setWards(wList)
          const matchedWard = wList.find((w) => w.name === addr.ward)
          setSelectedWard(matchedWard || null)
        } else {
          setSelectedDistrict(null)
          setSelectedWard(null)
          setWards([])
        }
      } catch {}
    } else {
      setSelectedProvince(null)
      setSelectedDistrict(null)
      setSelectedWard(null)
    }

    setFormVisible(true)
  }

  // Location Picker Handling
  const handleSelectProvince = async (prov: Province) => {
    setSelectedProvince(prov)
    setSelectedDistrict(null)
    setSelectedWard(null)
    setDistricts([])
    setWards([])
    setLocationSearch('')
    setPickerTab('district')
    
    try {
      setLoadingDistricts(true)
      const data = await vietnamProvincesService.getDistricts(prov.code)
      setDistricts(data)
    } finally {
      setLoadingDistricts(false)
    }
  }

  const handleSelectDistrict = async (dist: District) => {
    setSelectedDistrict(dist)
    setSelectedWard(null)
    setWards([])
    setLocationSearch('')
    setPickerTab('ward')
    
    try {
      setLoadingWards(true)
      const data = await vietnamProvincesService.getWards(dist.code)
      setWards(data)
    } finally {
      setLoadingWards(false)
    }
  }

  const handleSelectWard = (ward: Ward) => {
    setSelectedWard(ward)
    setPickerVisible(false)
    setLocationSearch('')
  }

  // Filter lists inside Picker
  const filteredProvinces = useMemo(() => 
    provinces.filter((p) => p.name.toLowerCase().includes(locationSearch.toLowerCase())),
  [provinces, locationSearch])

  const filteredDistricts = useMemo(() => 
    districts.filter((d) => d.name.toLowerCase().includes(locationSearch.toLowerCase())),
  [districts, locationSearch])

  const filteredWards = useMemo(() => 
    wards.filter((w) => w.name.toLowerCase().includes(locationSearch.toLowerCase())),
  [wards, locationSearch])

  const handleSaveBtn = async () => {
    if (!form.fullName.trim() || !form.phone.trim() || !form.addressLine1.trim() || !selectedProvince || !selectedDistrict || !selectedWard) {
      Alert.alert('Lỗi', 'Vui lòng điền đầy đủ các thông tin bắt buộc.')
      return
    }
    if (!validatePhone(form.phone)) return

    try {
      setSaving(true)
      const payload = {
        fullName: form.fullName,
        phone: form.phone,
        addressLine1: form.addressLine1,
        city: selectedProvince.name,
        district: selectedDistrict.name,
        ward: selectedWard.name,
        country: 'Vietnam',
        label: form.label || undefined,
        isDefault: form.isDefault,
      }

      if (editingId) {
        await userService.updateAddress(editingId, payload)
      } else {
        await userService.addAddress(payload)
      }
      setFormVisible(false)
      await loadAddresses()
    } catch (err: any) {
      Alert.alert('Lỗi', err.message || 'Thao tác thất bại')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (addressId: string) => {
    Alert.alert('Xác nhận', 'Bạn có chắc muốn xóa địa chỉ này?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Xóa', style: 'destructive', onPress: async () => {
          setDeletingId(addressId)
          try {
            await userService.deleteAddress(addressId)
            await loadAddresses()
          } catch (error: any) {
            Alert.alert('Lỗi', error.message || 'Không thể xóa địa chỉ')
          } finally {
            setDeletingId(null)
          }
      }},
    ])
  }

  const handleSetDefault = async (addressId: string) => {
    try {
      await userService.setDefaultAddress(addressId)
      await loadAddresses()
    } catch (error: any) {
      Alert.alert('Lỗi', error.message || 'Không thể đặt mặc định')
    }
  }

  const formatAddress = (address: Address) => {
    const parts = [
      address.addressLine1,
      address.addressLine2,
      address.ward,
      address.district,
      address.city,
      address.province,
    ].filter(Boolean)
    return parts.join(', ')
  }

  if (loading) return <Loading />

  // Render main screen
  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={[styles.header, { paddingTop: Math.max(insets.top, SIZES.xxl) + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Địa chỉ giao hàng</Text>
        <View style={styles.placeholder} />
      </View>

      <FlatList
        data={addresses}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <View style={[styles.addressCard, item.isDefault && styles.addressCardDefault]}>
            <View style={styles.addressHeader}>
              <View style={styles.addressInfo}>
                {item.label && <Text style={styles.label}>{item.label}</Text>}
                <Text style={styles.name}>{item.fullName}</Text>
                <Text style={styles.phone}>{item.phone}</Text>
              </View>
              {item.isDefault && (
                <View style={styles.defaultBadge}>
                  <Text style={styles.defaultText}>Mặc định</Text>
                </View>
              )}
            </View>

            <Text style={styles.addressText}>{formatAddress(item)}</Text>

            <View style={styles.addressActions}>
              {!item.isDefault && (
                <TouchableOpacity style={styles.actionButton} onPress={() => handleSetDefault(item.id)}>
                  <Ionicons name="checkmark-circle-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.actionText}>Mặc định</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.actionButton} onPress={() => openEditForm(item)}>
                <Ionicons name="create-outline" size={18} color={COLORS.primary} />
                <Text style={styles.actionText}>Sửa</Text>
              </TouchableOpacity>
              {!item.isDefault && (
                <TouchableOpacity style={styles.actionButton} onPress={() => handleDelete(item.id)} disabled={deletingId === item.id}>
                  <Ionicons name="trash-outline" size={18} color={COLORS.error} />
                  <Text style={[styles.actionText, { color: COLORS.error }]}>Xóa</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="location-outline" size={64} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>Chưa có địa chỉ nào</Text>
            <Text style={styles.emptySubtext}>Thêm địa chỉ để dễ dàng đặt hàng</Text>
          </View>
        }
      />

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, SIZES.lg) }]}>
        <Button
          title="Thêm địa chỉ mới"
          onPress={openAddForm}
          fullWidth
          size="lg"
          icon={<Ionicons name="add" size={20} color={COLORS.background} />}
        />
      </View>

      {/* --- FORM MODAL --- */}
      <Modal visible={formVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setFormVisible(false)}>
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#fff' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setFormVisible(false)} style={styles.modalCloseBtn}>
               <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{editingId ? 'Cập nhật địa chỉ' : 'Thêm địa chỉ mới'}</Text>
            <View style={styles.placeholder} />
          </View>
          
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
            <Text style={styles.inputLabel}>Họ và tên <Text style={{ color: COLORS.error }}>*</Text></Text>
            <TextInput
              style={styles.inputBox}
              placeholder="Nguyễn Văn A"
              value={form.fullName}
              onChangeText={(t) => setForm((p) => ({ ...p, fullName: t }))}
              autoCorrect={false}
              spellCheck={false}
            />

            <Text style={styles.inputLabel}>Số điện thoại <Text style={{ color: COLORS.error }}>*</Text></Text>
            <TextInput
              style={[styles.inputBox, phoneError ? { borderColor: COLORS.error } : null]}
              placeholder="(+84) 901 234 567"
              keyboardType="phone-pad"
              value={form.phone}
              onChangeText={(t) => {
                setForm((p) => ({ ...p, phone: t }))
                if (phoneError) validatePhone(t)
              }}
              onBlur={() => validatePhone(form.phone)}
            />
            {phoneError ? <Text style={styles.errorText}>{phoneError}</Text> : null}

            <Text style={styles.inputLabel}>Tỉnh/Thành phố, Quận/Huyện, Phường/Xã <Text style={{ color: COLORS.error }}>*</Text></Text>
            <TouchableOpacity style={styles.locationPickerBox} onPress={() => {
              setPickerTab('province')
              setLocationSearch('')
              setPickerVisible(true)
            }}>
              <Text style={[styles.locationPickerText, (!selectedProvince && !selectedDistrict && !selectedWard) && { color: COLORS.placeholder }]}>
                {[selectedProvince?.name, selectedDistrict?.name, selectedWard?.name].filter(Boolean).join(', ') || 'Chọn khu vực giao hàng'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>

            <Text style={styles.inputLabel}>Địa chỉ cụ thể <Text style={{ color: COLORS.error }}>*</Text></Text>
            <TextInput
              style={styles.inputBox}
              placeholder="Số nhà, Tên đường..."
              value={form.addressLine1}
              onChangeText={(t) => setForm((p) => ({ ...p, addressLine1: t }))}
              autoCorrect={false}
              spellCheck={false}
            />

            <Text style={styles.inputLabel}>Loại địa chỉ</Text>
            <TextInput
              style={styles.inputBox}
              placeholder="Văn phòng, Nhà riêng..."
              value={form.label}
              onChangeText={(t) => setForm((p) => ({ ...p, label: t }))}
              autoCorrect={false}
              spellCheck={false}
            />

            <TouchableOpacity style={styles.checkboxRow} onPress={() => setForm((p) => ({ ...p, isDefault: !p.isDefault }))}>
               <Ionicons name={form.isDefault ? 'checkbox' : 'square-outline'} size={24} color={form.isDefault ? COLORS.primary : COLORS.textSecondary} />
               <Text style={styles.checkboxText}>Đặt làm địa chỉ mặc định</Text>
            </TouchableOpacity>
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, SIZES.lg) }]}>
            <Button
              title="Lưu"
              onPress={handleSaveBtn}
              loading={saving}
              fullWidth
              size="lg"
            />
          </View>

          {/* --- LOCATION PICKER BOTTOM SHEET (Rendered inside the first modal to fix iOS nested modal bug) --- */}
          {pickerVisible && (
            <View style={[StyleSheet.absoluteFill, { zIndex: 999 }]}>
               <View style={styles.sheetOverlay}>
                 <TouchableWithoutFeedback onPress={() => setPickerVisible(false)}>
                   <View style={styles.sheetBackdrop} />
                 </TouchableWithoutFeedback>
                 <View style={[styles.sheetContent, { paddingBottom: Math.max(insets.bottom, 20) }]}>
                   <View style={styles.sheetHeader}>
                     <Text style={styles.sheetTitle}>Chọn khu vực</Text>
                     <TouchableOpacity onPress={() => setPickerVisible(false)}>
                       <Ionicons name="close" size={24} color={COLORS.text} />
                     </TouchableOpacity>
                   </View>

                   <View style={styles.searchRow}>
                     <Ionicons name="search" size={20} color={COLORS.textSecondary} />
                     <TextInput
                       style={styles.sheetSearchInput}
                       placeholder="Tìm kiếm..."
                       value={locationSearch}
                       onChangeText={setLocationSearch}
                       autoCorrect={false}
                     />
                   </View>

                   <View style={styles.sheetTabs}>
                     <TouchableOpacity onPress={() => { setPickerTab('province'); setLocationSearch('') }} style={[styles.sheetTab, pickerTab === 'province' && styles.sheetTabActive]}>
                       <Text style={[styles.sheetTabText, pickerTab === 'province' && styles.sheetTabTextActive]}>Tỉnh/ Thành</Text>
                     </TouchableOpacity>
                     <TouchableOpacity onPress={() => { if(selectedProvince) { setPickerTab('district'); setLocationSearch('') } }} style={[styles.sheetTab, pickerTab === 'district' && styles.sheetTabActive]}>
                       <Text style={[styles.sheetTabText, pickerTab === 'district' && styles.sheetTabTextActive, !selectedProvince && { color: COLORS.placeholder }]}>Quận/ Huyện</Text>
                     </TouchableOpacity>
                     <TouchableOpacity onPress={() => { if(selectedDistrict) { setPickerTab('ward'); setLocationSearch('') } }} style={[styles.sheetTab, pickerTab === 'ward' && styles.sheetTabActive]}>
                       <Text style={[styles.sheetTabText, pickerTab === 'ward' && styles.sheetTabTextActive, !selectedDistrict && { color: COLORS.placeholder }]}>Phường/ Xã</Text>
                     </TouchableOpacity>
                   </View>

                   <ScrollView style={{ height: 300 }}>
                      {pickerTab === 'province' && (
                        loadingProvinces ? <ActivityIndicator style={{marginTop: 20}} color={COLORS.primary} />
                        : filteredProvinces.map((p) => (
                          <TouchableOpacity key={p.code} style={styles.listItem} onPress={() => handleSelectProvince(p)}>
                            <Text style={[styles.listItemText, selectedProvince?.code === p.code && { color: COLORS.primary, fontWeight: 'bold' }]}>{p.name}</Text>
                            {selectedProvince?.code === p.code && <Ionicons name="checkmark" size={20} color={COLORS.primary} />}
                          </TouchableOpacity>
                        ))
                      )}
                      {pickerTab === 'district' && (
                        loadingDistricts ? <ActivityIndicator style={{marginTop: 20}} color={COLORS.primary} />
                        : filteredDistricts.map((d) => (
                          <TouchableOpacity key={d.code} style={styles.listItem} onPress={() => handleSelectDistrict(d)}>
                            <Text style={[styles.listItemText, selectedDistrict?.code === d.code && { color: COLORS.primary, fontWeight: 'bold' }]}>{d.name}</Text>
                            {selectedDistrict?.code === d.code && <Ionicons name="checkmark" size={20} color={COLORS.primary} />}
                          </TouchableOpacity>
                        ))
                      )}
                      {pickerTab === 'ward' && (
                        loadingWards ? <ActivityIndicator style={{marginTop: 20}} color={COLORS.primary} />
                        : filteredWards.map((w) => (
                          <TouchableOpacity key={w.code} style={styles.listItem} onPress={() => handleSelectWard(w)}>
                            <Text style={[styles.listItemText, selectedWard?.code === w.code && { color: COLORS.primary, fontWeight: 'bold' }]}>{w.name}</Text>
                            {selectedWard?.code === w.code && <Ionicons name="checkmark" size={20} color={COLORS.primary} />}
                          </TouchableOpacity>
                        ))
                      )}
                   </ScrollView>
                 </View>
               </View>
            </View>
          )}
        </KeyboardAvoidingView>
      </Modal>

    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SIZES.lg, paddingBottom: SIZES.md, backgroundColor: COLORS.background, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  backButton: { padding: SIZES.xs },
  headerTitle: { fontSize: FONTS.size.lg, fontWeight: 'bold', color: COLORS.text },
  placeholder: { width: 40 },
  listContent: { padding: SIZES.lg },
  addressCard: { backgroundColor: COLORS.card, borderRadius: 12, padding: SIZES.md, marginBottom: SIZES.md, borderWidth: 1, borderColor: COLORS.border },
  addressCardDefault: { borderColor: COLORS.primary },
  addressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SIZES.md },
  addressInfo: { flex: 1 },
  label: { fontSize: FONTS.size.xs, color: COLORS.primary, fontWeight: '600', marginBottom: SIZES.xs },
  name: { fontSize: FONTS.size.md, fontWeight: '600', color: COLORS.text, marginBottom: SIZES.xs },
  phone: { fontSize: FONTS.size.sm, color: COLORS.textSecondary },
  defaultBadge: { backgroundColor: COLORS.primary + '15', paddingHorizontal: SIZES.sm, paddingVertical: SIZES.xs, borderRadius: 6 },
  defaultText: { fontSize: FONTS.size.xs, color: COLORS.primary, fontWeight: '600' },
  addressText: { fontSize: FONTS.size.sm, color: COLORS.text, lineHeight: 20, marginBottom: SIZES.md },
  addressActions: { flexDirection: 'row', gap: SIZES.md, paddingTop: SIZES.md, borderTopWidth: 1, borderTopColor: COLORS.border },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: SIZES.xs },
  actionText: { fontSize: FONTS.size.sm, color: COLORS.primary, fontWeight: '500' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: SIZES.xxl * 2 },
  emptyText: { fontSize: FONTS.size.md, color: COLORS.text, fontWeight: '600', marginTop: SIZES.md },
  emptySubtext: { fontSize: FONTS.size.sm, color: COLORS.textSecondary, marginTop: SIZES.xs, textAlign: 'center' },
  footer: { paddingHorizontal: SIZES.lg, paddingTop: SIZES.lg, backgroundColor: COLORS.card, borderTopWidth: 1, borderTopColor: COLORS.border },

  // Form Modal Styles
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SIZES.lg, paddingVertical: SIZES.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalCloseBtn: { padding: SIZES.xs },
  modalTitle: { fontSize: FONTS.size.lg, fontWeight: 'bold' },
  modalScroll: { padding: SIZES.lg, paddingBottom: 40 },
  inputLabel: { fontSize: FONTS.size.sm, fontWeight: '600', color: COLORS.text, marginBottom: SIZES.xs, marginTop: SIZES.md },
  inputBox: { height: 48, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: SIZES.md, fontSize: FONTS.size.md, color: COLORS.text },
  errorText: { color: COLORS.error, fontSize: FONTS.size.xs, marginTop: 4 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, marginTop: SIZES.xl },
  checkboxText: { fontSize: FONTS.size.md, color: COLORS.text },
  
  // Location Picker Form Input
  locationPickerBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 48, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: SIZES.md },
  locationPickerText: { fontSize: FONTS.size.md, color: COLORS.text, flex: 1 },

  // Location Picker Bottom Sheet
  sheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheetBackdrop: { ...StyleSheet.absoluteFillObject },
  sheetContent: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '80%' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SIZES.lg, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  sheetTitle: { fontSize: FONTS.size.lg, fontWeight: 'bold', color: COLORS.text },
  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', margin: SIZES.md, paddingHorizontal: SIZES.md, borderRadius: 8, height: 40, gap: SIZES.sm },
  sheetSearchInput: { flex: 1, fontSize: FONTS.size.md, color: COLORS.text },
  sheetTabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  sheetTab: { flex: 1, alignItems: 'center', paddingVertical: SIZES.md, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  sheetTabActive: { borderBottomColor: COLORS.primary },
  sheetTabText: { fontSize: FONTS.size.sm, color: COLORS.textSecondary, fontWeight: '500' },
  sheetTabTextActive: { color: COLORS.primary, fontWeight: 'bold' },
  listItem: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: SIZES.lg, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
  listItemText: { fontSize: FONTS.size.md, color: COLORS.text },
})
