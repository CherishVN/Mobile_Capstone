import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, SIZES, FONTS } from '@/constants/theme'
import Button from './Button'

interface AlertDialogProps {
  visible: boolean
  title: string
  message: string
  type?: 'info' | 'success' | 'warning' | 'error'
  primaryButton?: {
    text: string
    onPress: () => void
  }
  secondaryButton?: {
    text: string
    onPress: () => void
  }
  onClose: () => void
}

export default function AlertDialog({
  visible,
  title,
  message,
  type = 'info',
  primaryButton,
  secondaryButton,
  onClose,
}: AlertDialogProps) {
  const iconName =
    type === 'success'
      ? 'checkmark-circle'
      : type === 'error'
      ? 'close-circle'
      : type === 'warning'
      ? 'warning'
      : 'information-circle'

  const iconColor =
    type === 'success'
      ? COLORS.success
      : type === 'error'
      ? COLORS.error
      : type === 'warning'
      ? COLORS.warning
      : COLORS.primary

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <View style={styles.iconContainer}>
            <Ionicons name={iconName} size={48} color={iconColor} />
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.actions}>
            {secondaryButton && (
              <Button
                title={secondaryButton.text}
                onPress={secondaryButton.onPress}
                variant="outline"
                style={styles.button}
              />
            )}
            {primaryButton && (
              <Button
                title={primaryButton.text}
                onPress={primaryButton.onPress}
                style={styles.button}
              />
            )}
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.lg,
  },
  dialog: {
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: SIZES.lg,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: SIZES.md,
  },
  title: {
    fontSize: FONTS.size.lg,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SIZES.sm,
    textAlign: 'center',
  },
  message: {
    fontSize: FONTS.size.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SIZES.lg,
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    gap: SIZES.sm,
    width: '100%',
  },
  button: {
    flex: 1,
  },
})
