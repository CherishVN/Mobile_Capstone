import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
} from 'react-native'
import { useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import Button from '@/components/Button'
import Input from '@/components/Input'
import { authService } from '@/services/auth-service'
import { COLORS, SIZES, FONTS } from '@/constants/theme'

export default function RegisterScreen() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{
    fullName?: string
    email?: string
    password?: string
    confirmPassword?: string
  }>({})

  const validate = () => {
    const newErrors: any = {}

    if (!fullName.trim()) {
      newErrors.fullName = 'Vui lòng nhập họ tên'
    }

    if (!email.trim()) {
      newErrors.email = 'Vui lòng nhập email'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Email không hợp lệ'
    }

    if (!password) {
      newErrors.password = 'Vui lòng nhập mật khẩu'
    } else if (password.length < 6) {
      newErrors.password = 'Mật khẩu phải có ít nhất 6 ký tự'
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Vui lòng xác nhận mật khẩu'
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Mật khẩu không khớp'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleRegister = async () => {
    if (!validate()) return

    setLoading(true)
    try {
      await authService.signUp({ email, password, fullName })
      Alert.alert(
        'Đăng ký thành công',
        'Vui lòng kiểm tra email để xác thực tài khoản',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/auth/login'),
          },
        ]
      )
    } catch (error: any) {
      Alert.alert('Đăng ký thất bại', error.message || 'Có lỗi xảy ra')
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
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Đăng ký</Text>
          <Text style={styles.subtitle}>Tạo tài khoản mới</Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Họ và tên"
            placeholder="Nhập họ và tên"
            value={fullName}
            onChangeText={setFullName}
            leftIcon="person-outline"
            error={errors.fullName}
          />

          <Input
            label="Email"
            placeholder="Nhập email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            leftIcon="mail-outline"
            error={errors.email}
          />

          <Input
            label="Mật khẩu"
            placeholder="Nhập mật khẩu (tối thiểu 6 ký tự)"
            value={password}
            onChangeText={setPassword}
            isPassword
            leftIcon="lock-closed-outline"
            error={errors.password}
          />

          <Input
            label="Xác nhận mật khẩu"
            placeholder="Nhập lại mật khẩu"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            isPassword
            leftIcon="lock-closed-outline"
            error={errors.confirmPassword}
          />

          <Button
            title="Đăng ký"
            onPress={handleRegister}
            loading={loading}
            fullWidth
            size="lg"
          />

          <View style={styles.footer}>
            <Text style={styles.footerText}>Đã có tài khoản? </Text>
            <TouchableOpacity onPress={() => router.push('/auth/login')}>
              <Text style={styles.linkText}>Đăng nhập</Text>
            </TouchableOpacity>
          </View>
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
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: SIZES.lg,
  },
  header: {
    marginBottom: SIZES.xxl,
  },
  title: {
    fontSize: FONTS.size.xxxl,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SIZES.xs,
  },
  subtitle: {
    fontSize: FONTS.size.md,
    color: COLORS.textSecondary,
  },
  form: {
    gap: SIZES.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SIZES.lg,
  },
  footerText: {
    fontSize: FONTS.size.md,
    color: COLORS.textSecondary,
  },
  linkText: {
    fontSize: FONTS.size.md,
    color: COLORS.primary,
    fontWeight: '600',
  },
})
