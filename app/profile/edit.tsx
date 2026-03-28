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
} from 'react-native'
import { useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Ionicons } from '@expo/vector-icons'
import Input from '@/components/Input'
import Button from '@/components/Button'
import { userService } from '@/services/user-service'
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

  useEffect(() => {
    loadProfile()
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
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {fullName?.charAt(0).toUpperCase() || 'U'}
            </Text>
          </View>
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
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: FONTS.size.xxxl + 8,
    fontWeight: 'bold',
    color: COLORS.background,
  },
  form: {
    padding: SIZES.lg,
  },
})
