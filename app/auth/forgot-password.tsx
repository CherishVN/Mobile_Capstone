import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
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

export default function ForgotPasswordScreen() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const validate = () => {
    if (!email.trim()) {
      setError('Vui lòng nhập email')
      return false
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Email không hợp lệ')
      return false
    }
    setError('')
    return true
  }

  const handleResetPassword = async () => {
    if (!validate()) return

    setLoading(true)
    try {
      await authService.resetPassword(email)
      Alert.alert(
        'Thành công',
        'Vui lòng kiểm tra email để đặt lại mật khẩu',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      )
    } catch (error: any) {
      Alert.alert('Lỗi', error.message || 'Có lỗi xảy ra')
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
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Quên mật khẩu</Text>
          <Text style={styles.subtitle}>
            Nhập email của bạn để nhận liên kết đặt lại mật khẩu
          </Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Email"
            placeholder="Nhập email của bạn"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            leftIcon="mail-outline"
            error={error}
          />

          <Button
            title="Gửi liên kết đặt lại"
            onPress={handleResetPassword}
            loading={loading}
            fullWidth
            size="lg"
          />

          <View style={styles.footer}>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.linkText}>Quay lại đăng nhập</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
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
    lineHeight: 22,
  },
  form: {
    gap: SIZES.md,
  },
  footer: {
    alignItems: 'center',
    marginTop: SIZES.lg,
  },
  linkText: {
    fontSize: FONTS.size.md,
    color: COLORS.primary,
    fontWeight: '600',
  },
})
