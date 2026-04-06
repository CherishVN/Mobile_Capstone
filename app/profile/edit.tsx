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

export default function EditProfileScreen() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  useEffect(() => {
    loadProfile()
    loadAvatar()
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
          <Input
            label="Email"
            value={profile?.email || ''}
            editable={false}
            leftIcon="mail-outline"
          />

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
})
