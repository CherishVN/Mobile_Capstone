import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native'
import { useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { decode } from 'base64-arraybuffer'
import Input from '@/components/Input'
import Button from '@/components/Button'
import { userService } from '@/services/user-service'
import { supabase } from '@/lib/supabase'
import { UserProfile } from '@/types/user'
import Loading from '@/components/Loading'
import { COLORS, SIZES, FONTS } from '@/constants/theme'

function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return email
  return `${local.slice(0, 2)}${'*'.repeat(Math.max(local.length - 2, 3))}@${domain}`
}

export default function EditProfileScreen() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  // Email change state
  const [emailModalVisible, setEmailModalVisible] = useState(false)
  const [emailStep, setEmailStep] = useState<'input' | 'otp'>('input')
  const [newEmail, setNewEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [sendingOtp, setSendingOtp] = useState(false)
  const [verifyingOtp, setVerifyingOtp] = useState(false)
  const [isOAuth, setIsOAuth] = useState(false)

  useEffect(() => {
    loadProfile()
    loadAvatar()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.app_metadata?.provider && user.app_metadata.provider !== 'email') {
        setIsOAuth(true)
      }
    })
  }, [])

  const loadProfile = async () => {
    try {
      const response = await userService.getProfile()
      if (response.success && response.data) {
        setProfile(response.data)
        setFullName(response.data.fullName || '')
        setPhone(response.data.phone || '')
      }
    } catch (error: any) {
      Alert.alert('Lỗi', 'Không thể tải thông tin')
    } finally {
      setLoading(false)
    }
  }

  const loadAvatar = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const storagePath = user.user_metadata?.avatar_storage_path as string | undefined
      if (storagePath) {
        const { data } = await supabase.storage
          .from('image')
          .createSignedUrl(storagePath, 3600)
        if (data?.signedUrl) {
          setAvatarUrl(data.signedUrl)
          return
        }
      }
      const oauthAvatar = user.user_metadata?.avatar_url as string | undefined
      if (oauthAvatar) setAvatarUrl(oauthAvatar)
    } catch {}
  }

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Quyền truy cập', 'Cần quyền truy cập thư viện ảnh để chọn avatar')
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      })

      if (result.canceled || !result.assets?.[0]) return

      const asset = result.assets[0]

      // Validate size (max 1MB)
      if (asset.fileSize && asset.fileSize > 1024 * 1024) {
        Alert.alert('Lỗi', 'File quá lớn. Dung lượng tối đa 1 MB')
        return
      }

      setUploadingAvatar(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Chưa đăng nhập')

      const ext = asset.uri.split('.').pop() || 'jpg'
      const storagePath = `avatars/${user.id}/avatar-${Date.now()}.${ext}`

      // Decode base64 to buffer to avoid React Native blob corruption
      const arrayBuffer = decode(asset.base64!)

      const { error: uploadError } = await supabase.storage
        .from('image')
        .upload(storagePath, arrayBuffer, {
          upsert: true,
          cacheControl: '0',
          contentType: `image/${ext === 'png' ? 'png' : 'jpeg'}`,
        })
      if (uploadError) throw uploadError

      // Update user metadata
      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar_storage_path: storagePath },
      })
      if (updateError) throw updateError

      // Reload avatar
      const { data } = await supabase.storage
        .from('image')
        .createSignedUrl(storagePath, 3600)
      if (data?.signedUrl) {
        setAvatarUrl(data.signedUrl)
      }

      Alert.alert('Thành công', 'Đã cập nhật ảnh đại diện')
    } catch (error: any) {
      Alert.alert('Lỗi', error.message || 'Không thể tải ảnh lên')
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await userService.updateProfile({ fullName, phone })
      Alert.alert('Thành công', 'Đã cập nhật thông tin', [
        { text: 'OK', onPress: () => router.back() },
      ])
    } catch (error: any) {
      Alert.alert('Lỗi', error.message || 'Không thể cập nhật')
    } finally {
      setSaving(false)
    }
  }

  const openEmailModal = () => {
    setNewEmail('')
    setOtp('')
    setEmailStep('input')
    setEmailModalVisible(true)
  }

  const handleSendOtp = async () => {
    if (!newEmail.trim()) return
    setSendingOtp(true)
    try {
      const res = await userService.requestEmailChange(newEmail.trim())
      if (res.success) {
        setEmailStep('otp')
      } else {
        Alert.alert('Lỗi', res.message ?? 'Không thể gửi mã OTP')
      }
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Không thể gửi mã OTP')
    } finally {
      setSendingOtp(false)
    }
  }

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) return
    setVerifyingOtp(true)
    try {
      const res = await userService.confirmEmailChange(newEmail.trim(), otp)
      if (res.success) {
        setEmailModalVisible(false)
        Alert.alert('Thành công', 'Email đã được cập nhật. Vui lòng đăng nhập lại.')
        await loadProfile()
      } else {
        Alert.alert('Lỗi', res.message ?? 'Mã OTP không đúng')
      }
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Mã OTP không hợp lệ')
    } finally {
      setVerifyingOtp(false)
    }
  }

  if (loading) {
    return <Loading />
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
        <Text style={styles.headerTitle}>Chỉnh sửa thông tin</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Avatar section with upload */}
        <View style={styles.avatarSection}>
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={handlePickImage}
            disabled={uploadingAvatar}
            activeOpacity={0.7}
          >
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {fullName?.charAt(0).toUpperCase() || 'U'}
                </Text>
              </View>
            )}
            {uploadingAvatar ? (
              <View style={styles.avatarOverlay}>
                <ActivityIndicator size="small" color={COLORS.onPrimary} />
              </View>
            ) : (
              <View style={styles.cameraIcon}>
                <Ionicons name="camera" size={16} color={COLORS.onPrimary} />
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={handlePickImage} disabled={uploadingAvatar}>
            <Text style={styles.changeAvatarText}>
              {uploadingAvatar ? 'Đang tải...' : 'Chọn Ảnh'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.avatarHint}>Dung lượng tối đa 1 MB • JPEG, PNG</Text>
        </View>

        <View style={styles.form}>
          {/* Email row with change button */}
          <View style={styles.emailRow}>
            <Text style={styles.emailLabel}>Email</Text>
            <View style={styles.emailValueRow}>
              <Ionicons name="mail-outline" size={18} color={COLORS.textSecondary} style={{ marginRight: 6 }} />
              <Text style={styles.emailValue}>
                {profile?.email ? maskEmail(profile.email) : '—'}
              </Text>
              {!isOAuth && (
                <TouchableOpacity onPress={openEmailModal} style={styles.emailChangeBtn}>
                  <Text style={styles.emailChangeBtnText}>Thay đổi</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <Input
            label="Họ và tên"
            placeholder="Nhập họ và tên"
            value={fullName}
            onChangeText={setFullName}
            leftIcon="person-outline"
          />

          <Input
            label="Số điện thoại"
            placeholder="Nhập số điện thoại"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            leftIcon="call-outline"
          />

          <Button title="Lưu thay đổi" onPress={handleSave} loading={saving} fullWidth size="lg" />
        </View>
      </ScrollView>

      {/* Email change modal */}
      <Modal
        visible={emailModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setEmailModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => {
                if (emailStep === 'otp') { setEmailStep('input'); setOtp('') }
                else setEmailModalVisible(false)
              }}>
                <Ionicons name={emailStep === 'otp' ? 'arrow-back' : 'close'} size={24} color={COLORS.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Thay đổi Email</Text>
              <View style={{ width: 24 }} />
            </View>

            <Text style={styles.modalDesc}>
              {emailStep === 'input'
                ? 'Nhập email mới. Mã OTP 6 số sẽ được gửi đến email này.'
                : `Nhập mã OTP đã gửi đến ${newEmail}`}
            </Text>

            {emailStep === 'input' ? (
              <View>
                <TextInput
                  style={styles.modalInput}
                  placeholder="email@example.com"
                  placeholderTextColor={COLORS.placeholder}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={newEmail}
                  onChangeText={setNewEmail}
                  onSubmitEditing={handleSendOtp}
                  returnKeyType="send"
                />
                <TouchableOpacity
                  style={[styles.modalBtn, (!newEmail.trim() || sendingOtp) && styles.modalBtnDisabled]}
                  disabled={!newEmail.trim() || sendingOtp}
                  onPress={handleSendOtp}
                >
                  {sendingOtp
                    ? <ActivityIndicator color={COLORS.onPrimary} />
                    : <Text style={styles.modalBtnText}>Gửi mã OTP</Text>}
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <View style={styles.otpRow}>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <View key={i} style={[styles.otpBox, otp.length > i && styles.otpBoxFilled]}>
                      <Text style={styles.otpChar}>{otp[i] ?? ''}</Text>
                    </View>
                  ))}
                </View>
                <TextInput
                  style={styles.otpHidden}
                  value={otp}
                  onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))}
                  keyboardType="numeric"
                  maxLength={6}
                  autoFocus
                />
                <TouchableOpacity
                  style={[styles.modalBtn, (otp.length !== 6 || verifyingOtp) && styles.modalBtnDisabled]}
                  disabled={otp.length !== 6 || verifyingOtp}
                  onPress={handleVerifyOtp}
                >
                  {verifyingOtp
                    ? <ActivityIndicator color={COLORS.onPrimary} />
                    : <Text style={styles.modalBtnText}>Xác nhận</Text>}
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { setEmailStep('input'); setOtp('') }}
                  style={{ marginTop: SIZES.sm, alignItems: 'center' }}
                >
                  <Text style={{ color: COLORS.primary, fontSize: FONTS.size.sm, textDecorationLine: 'underline' }}>
                    Gửi lại mã
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.lg,
    paddingTop: SIZES.xxl + 10,
    paddingBottom: SIZES.md,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: SIZES.xs,
  },
  headerTitle: {
    fontSize: FONTS.size.lg,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: SIZES.xl,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  avatarText: {
    fontSize: FONTS.size.xxxl + 8,
    fontWeight: 'bold',
    color: COLORS.background,
  },
  avatarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 50,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.card,
  },
  changeAvatarText: {
    marginTop: SIZES.md,
    fontSize: FONTS.size.sm,
    fontWeight: '600',
    color: COLORS.primary,
  },
  avatarHint: {
    marginTop: SIZES.xs,
    fontSize: FONTS.size.xs,
    color: COLORS.textSecondary,
  },
  form: {
    padding: SIZES.lg,
  },
  emailRow: {
    marginBottom: SIZES.md,
  },
  emailLabel: {
    fontSize: FONTS.size.sm,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 6,
  },
  emailValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: SIZES.md,
    paddingVertical: 10,
    backgroundColor: COLORS.background,
  },
  emailValue: {
    flex: 1,
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
  },
  emailChangeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  emailChangeBtnText: {
    fontSize: FONTS.size.xs,
    color: COLORS.primary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  modalOverlay: {
    flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalSheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: SIZES.lg, paddingBottom: SIZES.xl,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: SIZES.sm,
  },
  modalTitle: {
    fontSize: FONTS.size.md, fontWeight: '700', color: COLORS.text,
  },
  modalDesc: {
    fontSize: FONTS.size.sm, color: COLORS.textSecondary,
    marginBottom: SIZES.md, lineHeight: 20,
  },
  modalInput: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    paddingHorizontal: SIZES.md, paddingVertical: 10,
    fontSize: FONTS.size.sm, color: COLORS.text, marginBottom: SIZES.md,
  },
  modalBtn: {
    backgroundColor: COLORS.primary, borderRadius: 12,
    paddingVertical: 13, alignItems: 'center',
  },
  modalBtnDisabled: { opacity: 0.5 },
  modalBtnText: { color: COLORS.onPrimary, fontWeight: '700', fontSize: FONTS.size.sm },
  otpRow: {
    flexDirection: 'row', justifyContent: 'center', gap: SIZES.sm, marginBottom: SIZES.md,
  },
  otpBox: {
    width: 44, height: 52, borderRadius: 10,
    borderWidth: 1.5, borderColor: COLORS.border,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  otpBoxFilled: { borderColor: COLORS.primary, backgroundColor: COLORS.chatRowHighlight },
  otpChar: { fontSize: FONTS.size.xl, fontWeight: '700', color: COLORS.text },
  otpHidden: {
    position: 'absolute', opacity: 0, width: 1, height: 1,
  },
})
