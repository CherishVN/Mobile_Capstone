import * as Device from 'expo-device'
import * as Linking from 'expo-linking'

function getLanHostFromEnv(): string | null {
  const raw = process.env.EXPO_PUBLIC_API_URL || ''
  try {
    return new URL(raw).hostname
  } catch {
    return null
  }
}

export function getOAuthRedirectUrl(): string {
  let url = Linking.createURL('/auth/callback')
  const lanHost = getLanHostFromEnv()
  const isLocal =
    url.includes('localhost') ||
    url.includes('127.0.0.1') ||
    /:\/\/0\.0\.0\.0/.test(url)

  if (
    Device.isDevice &&
    lanHost &&
    isLocal &&
    lanHost !== 'localhost' &&
    lanHost !== '127.0.0.1'
  ) {
    url = url
      .replace(/localhost|127\.0\.0\.1/g, lanHost)
      .replace('://0.0.0.0', `://${lanHost}`)
  }

  return url
}
