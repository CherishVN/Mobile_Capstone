import React, { useState } from 'react'
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
import { authService } from '@/services/auth-service'
import { COLORS, SIZES, FONTS } from '@/constants/theme'

export default function ChangePasswordScreen() {
  const router = useRouter()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{
    currentPassword?: string
    newPassword?: string
    confirmPassword?: string
  }>({})

  const validate = () => {
    const newErrors: any = {}

    if (!currentPassword) {
      newErrors.currentPassword = 'Vui lòng nhập mật khẩu hiện tại'
    }

    if (!newPassword) {
      newErrors.newPassword = 'Vui lòng nhập mật khẩu mới'
    } else if (newPassword.length < 6) {
      newErrors.newPassword = 'Mật khẩu phải có ít nhất 6 ký tự'
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Vui lòng xác nhận mật khẩu mới'
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = 'Mật khẩu không khớp'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleChangePassword = async () => {
    if (!validate()) return

    setLoading(true)
    try {
      await authService.updatePassword(newPassword)
      Alert.alert('Thành công', 'Đã đổi mật khẩu', [
        { text: 'OK', onPress: () => router.back() },
      ])
    } catch (error: any) {
      Alert.alert('Lỗi', error.message || 'Không thể đổi mật khẩu')
    } finally {
      setLoading(false)
    }
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
        <Text style={styles.headerTitle}>Đổi mật khẩu</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.form}>
          <Input
            label="Mật khẩu hiện tại"
            placeholder="Nhập mật khẩu hiện tại"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            isPassword
            leftIcon="lock-closed-outline"
            error={errors.currentPassword}
          />

          <Input
            label="Mật khẩu mới"
            placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
            value={newPassword}
            onChangeText={setNewPassword}
            isPassword
            leftIcon="lock-closed-outline"
            error={errors.newPassword}
          />

          <Input
            label="Xác nhận mật khẩu mới"
            placeholder="Nhập lại mật khẩu mới"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            isPassword
            leftIcon="lock-closed-outline"
            error={errors.confirmPassword}
          />

          <Button
            title="Đổi mật khẩu"
            onPress={handleChangePassword}
            loading={loading}
            fullWidth
            size="lg"
          />
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
  form: {
    padding: SIZES.lg,
  },
})
