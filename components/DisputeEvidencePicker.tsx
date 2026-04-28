import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { Image } from 'expo-image'
import * as FileSystem from 'expo-file-system/legacy'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { decode } from 'base64-arraybuffer'
import { supabase } from '@/lib/supabase'
import { COLORS } from '@/constants/theme'

const MAX_FILES = 10
const MAX_SIZE_BYTES = 20 * 1024 * 1024
const BUCKET = 'product-images'

/**
 * Android `content://` và nhiều URI thư viện không đọc được bằng `fetch` → "Network request failed".
 * Dùng expo-file-system (base64 → ArrayBuffer); fallback fetch cho trường hợp file:// ổn định.
 */
async function readPickedAssetAsArrayBuffer(uri: string): Promise<ArrayBuffer> {
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    })
    return decode(base64)
  } catch {
    const response = await fetch(uri)
    if (!response.ok) {
      throw new Error(`Không đọc được file (${response.status})`)
    }
    return await response.arrayBuffer()
  }
}

type Props = {
  urls: string[]
  onChange: React.Dispatch<React.SetStateAction<string[]>>
  disabled?: boolean
}

function extAndContentType(asset: ImagePicker.ImagePickerAsset): { ext: string; contentType: string } {
  const mime = (asset.mimeType ?? '').toLowerCase()
  const mimeMap: Record<string, { ext: string; contentType: string }> = {
    'image/jpeg': { ext: 'jpg', contentType: 'image/jpeg' },
    'image/jpg': { ext: 'jpg', contentType: 'image/jpeg' },
    'image/png': { ext: 'png', contentType: 'image/png' },
    'image/gif': { ext: 'gif', contentType: 'image/gif' },
    'image/webp': { ext: 'webp', contentType: 'image/webp' },
    'image/heic': { ext: 'heic', contentType: 'image/heic' },
    'image/heif': { ext: 'heif', contentType: 'image/heif' },
    'video/mp4': { ext: 'mp4', contentType: 'video/mp4' },
    'video/quicktime': { ext: 'mov', contentType: 'video/quicktime' },
  }
  if (mime && mimeMap[mime]) return mimeMap[mime]

  const fromName = asset.fileName?.split('.').pop()?.toLowerCase()
  if (fromName && fromName.length <= 5) {
    const extToMime: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      heic: 'image/heic',
      heif: 'image/heif',
      mp4: 'video/mp4',
      mov: 'video/quicktime',
    }
    const ct = extToMime[fromName] ?? (asset.type === 'video' ? 'video/mp4' : 'image/jpeg')
    return { ext: fromName === 'jpeg' ? 'jpg' : fromName, contentType: ct }
  }

  const fallbackExt = asset.type === 'video' ? 'mp4' : 'jpg'
  return {
    ext: fallbackExt,
    contentType: asset.type === 'video' ? 'video/mp4' : 'image/jpeg',
  }
}

function isProbablyImageUrl(url: string) {
  return /\.(jpg|jpeg|png|gif|webp|heic|heif)(\?|$)/i.test(url)
}

export function DisputeEvidencePicker({ urls, onChange, disabled }: Props) {
  const [uploading, setUploading] = useState(false)

  const pick = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('Thiếu quyền', 'Vui lòng cấp quyền truy cập thư viện ảnh')
      return
    }
    const remaining = MAX_FILES - urls.length
    if (remaining <= 0) return

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: remaining,
    })
    if (result.canceled || !result.assets.length) return

    setUploading(true)
    const newUrls: string[] = []
    const uploadErrors: string[] = []

    for (const asset of result.assets) {
      const label = asset.fileName ?? 'media'
      try {
        const info = await FileSystem.getInfoAsync(asset.uri)
        if (info.exists && info.size > MAX_SIZE_BYTES) {
          uploadErrors.push(`${label}: File quá lớn (tối đa ${MAX_SIZE_BYTES / 1024 / 1024}MB)`)
          continue
        }
      } catch {
        /* bỏ qua nếu getInfo không hỗ trợ URI này */
      }

      try {
        const { ext, contentType } = extAndContentType(asset)
        const path = `dispute-evidence/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const arrayBuffer = await readPickedAssetAsArrayBuffer(asset.uri)
        if (arrayBuffer.byteLength > MAX_SIZE_BYTES) {
          uploadErrors.push(`${label}: File quá lớn (tối đa ${MAX_SIZE_BYTES / 1024 / 1024}MB)`)
          continue
        }
        const { error } = await supabase.storage.from(BUCKET).upload(path, arrayBuffer, {
          contentType,
          upsert: false,
        })
        if (error) {
          uploadErrors.push(`${label}: ${error.message}`)
          continue
        }
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
        newUrls.push(data.publicUrl)
      } catch (e) {
        uploadErrors.push(
          `${label}: ${e instanceof Error ? e.message : 'Lỗi đọc hoặc tải file'}`,
        )
      }
    }

    setUploading(false)

    if (newUrls.length > 0) {
      onChange((prev) => [...prev, ...newUrls])
    }

    if (uploadErrors.length > 0) {
      Alert.alert(
        newUrls.length > 0 ? 'Một số file chưa tải được' : 'Không tải được bằng chứng',
        uploadErrors.slice(0, 4).join('\n') +
          (uploadErrors.length > 4 ? `\n… và ${uploadErrors.length - 4} lỗi khác` : ''),
      )
    }
  }

  const remove = (idx: number) => {
    onChange((prev) => prev.filter((_, i) => i !== idx))
  }

  return (
    <View style={styles.wrap}>
      {urls.map((u, i) => (
        <View key={`${u}-${i}`} style={styles.chip}>
          {isProbablyImageUrl(u) ? (
            <Image
              source={{ uri: u }}
              style={styles.thumb}
              contentFit="cover"
              transition={120}
            />
          ) : (
            <Ionicons name="videocam-outline" size={16} color={COLORS.primary} />
          )}
          <Text style={styles.chipText} numberOfLines={1}>
            {isProbablyImageUrl(u) ? `Ảnh ${i + 1}` : `Video ${i + 1}`}
          </Text>
          {!disabled && (
            <TouchableOpacity
              onPress={() => remove(i)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={16} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      ))}
      {urls.length < MAX_FILES && !disabled && (
        <TouchableOpacity
          style={[styles.addBtn, uploading && styles.addBtnDisabled]}
          onPress={() => void pick()}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={16} color={COLORS.primary} />
              <Text style={styles.addBtnText}>Thêm ảnh/video</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumb: { width: 28, height: 28, borderRadius: 6, backgroundColor: '#f3f4f6' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 5,
    maxWidth: 200,
  },
  chipText: { fontSize: 12, color: COLORS.primary, flex: 1, minWidth: 0 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addBtnDisabled: { opacity: 0.5 },
  addBtnText: { fontSize: 12, color: COLORS.primary, fontWeight: '500' },
})
