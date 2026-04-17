import { useEffect, useRef, useState } from 'react'
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Platform,
} from 'react-native'
import { WebView } from 'react-native-webview'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import Loading from '@/components/Loading'
import { COLORS, FONTS, SIZES } from '@/constants/theme'

function isCallbackUrl(url: string): boolean {
  return (
    url.startsWith('http://localhost') ||
    url.startsWith('http://127.0.0.1')
  )
}

function extractParamsFromUrl(url: string) {
  try {
    const hashStart = url.indexOf('#')
    const queryStart = url.indexOf('?')

    const queryString =
      queryStart !== -1
        ? url.substring(queryStart + 1, hashStart !== -1 ? hashStart : undefined)
        : ''
    const hashString = hashStart !== -1 ? url.substring(hashStart + 1) : ''

    const qp = new URLSearchParams(queryString)
    const hp = new URLSearchParams(hashString)

    return {
      code: qp.get('code'),
      accessToken: hp.get('access_token') || qp.get('access_token'),
      refreshToken: hp.get('refresh_token') || qp.get('refresh_token'),
      error: qp.get('error') || hp.get('error'),
      errorDescription:
        qp.get('error_description') || hp.get('error_description'),
    }
  } catch {
    return { code: null, accessToken: null, refreshToken: null, error: null, errorDescription: null }
  }
}

export default function GoogleAuthScreen() {
  const router = useRouter()
  const [authUrl, setAuthUrl] = useState<string | null>(null)
  const handledRef = useRef(false)

  useEffect(() => {
    supabase.auth
      .signInWithOAuth({
        provider: 'google',
        options: {
          skipBrowserRedirect: true,
          redirectTo: 'http://localhost/auth/callback',
        },
      })
      .then(({ data, error }) => {
        if (data?.url) {
          setAuthUrl(data.url)
        } else {
          router.back()
        }
      })
  }, [])

  const handleRedirect = async (url: string) => {
    if (handledRef.current) return
    handledRef.current = true

    try {
      const { code, accessToken, refreshToken, error } =
        extractParamsFromUrl(url)

      if (error) {
        router.back()
        return
      }

      if (code) {
        const { error: exchangeErr } =
          await supabase.auth.exchangeCodeForSession(code)
        if (!exchangeErr) {
          router.replace('/(tabs)/home')
          return
        }
      }

      if (accessToken && refreshToken) {
        const { error: sessionErr } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        if (!sessionErr) {
          router.replace('/(tabs)/home')
          return
        }
      }

      router.back()
    } catch {
      router.back()
    }
  }

  if (!authUrl) return <Loading />

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => router.back()}
        >
          <Ionicons name="close" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Đăng nhập Google</Text>
        <View style={styles.closeBtn} />
      </View>

      <WebView
        source={{ uri: authUrl }}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        renderLoading={() => <Loading />}
        onShouldStartLoadWithRequest={(request) => {
          if (isCallbackUrl(request.url)) {
            handleRedirect(request.url)
            return false
          }
          return true
        }}
        onNavigationStateChange={(navState) => {
          if (isCallbackUrl(navState.url)) {
            handleRedirect(navState.url)
          }
        }}
        userAgent={
          Platform.OS === 'ios'
            ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
            : 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.280 Mobile Safari/537.36'
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 56 : 12,
    paddingBottom: 12,
    paddingHorizontal: SIZES.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FONTS.size.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  webview: {
    flex: 1,
  },
})
