import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  BackHandler,
  Platform,
} from 'react-native'
import { useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { WebView, type WebViewNavigation } from 'react-native-webview'
import { Ionicons } from '@expo/vector-icons'
import {
  consumePendingVnPayUrl,
  tryCompleteVnPayWebViewReturn,
} from '@/lib/vnpay-in-app'
import { resolveIntentUrlForWebView } from '@/lib/vnpay-webview-nav'
import { COLORS, SIZES, FONTS } from '@/constants/theme'

/** Giảm tỷ lệ cổng chặn WebView mặc định. */
const WEBVIEW_UA = Platform.select({
  ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  default:
    'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
})

export default function VnPayWebScreen() {
  const router = useRouter()
  const webRef = useRef<WebView>(null)
  const settledRef = useRef(false)
  const [uri, setUri] = useState<string | null>(null)
  const [canGoBack, setCanGoBack] = useState(false)

  const tryReturn = useCallback((url: string) => {
    if (settledRef.current) return false
    if (!tryCompleteVnPayWebViewReturn(url)) return false
    settledRef.current = true
    return true
  }, [])

  /** Giữ thanh toán trong WebView: window.open / intent:// thường bị Android chuyển sang Chrome nếu không xử lý. */
  const openInSameWebView = useCallback(
    (url: string) => {
      if (tryReturn(url)) return
      if (Platform.OS === 'android' && url.startsWith('intent://')) {
        const next = resolveIntentUrlForWebView(url)
        if (next) {
          setUri(next)
          return
        }
      }
      if (url.startsWith('http://') || url.startsWith('https://')) {
        setUri(url)
      }
    },
    [tryReturn]
  )

  const onShouldStartLoadWithRequest = useCallback(
    (req: { url: string }) => {
      const url = req.url
      if (tryReturn(url)) return false
      if (Platform.OS === 'android' && url.startsWith('intent://')) {
        const next = resolveIntentUrlForWebView(url)
        if (next) {
          setUri(next)
          return false
        }
      }
      return true
    },
    [tryReturn]
  )

  useEffect(() => {
    const u = consumePendingVnPayUrl()
    if (!u) {
      router.back()
      return
    }
    setUri(u)
  }, [router])

  const onBack = useCallback(() => {
    if (canGoBack) {
      webRef.current?.goBack()
      return true
    }
    router.back()
    return true
  }, [canGoBack, router])

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack)
    return () => sub.remove()
  }, [onBack])

  const handleNavChange = useCallback(
    (nav: WebViewNavigation) => {
      setCanGoBack(nav.canGoBack)
      tryReturn(nav.url)
    },
    [tryReturn]
  )

  if (!uri) {
    return (
      <View style={styles.centered}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.toolbar}>
        <TouchableOpacity onPress={onBack} style={styles.toolbarBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.toolbarTitle} numberOfLines={1}>
          Thanh toán VNPay
        </Text>
        <View style={styles.toolbarSpacer} />
      </View>
      <WebView
        ref={webRef}
        source={{ uri }}
        userAgent={WEBVIEW_UA}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        thirdPartyCookiesEnabled
        sharedCookiesEnabled
        startInLoadingState
        setSupportMultipleWindows={true}
        onOpenWindow={(e) => openInSameWebView(e.nativeEvent.targetUrl)}
        onNavigationStateChange={handleNavChange}
        onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: SIZES.xl,
    paddingBottom: SIZES.sm,
    paddingHorizontal: SIZES.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  toolbarBtn: { padding: SIZES.xs },
  toolbarTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: FONTS.size.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  toolbarSpacer: { width: 34 },
  webview: { flex: 1 },
})
