/**
 * VNPay / cổng thanh toán hay redirect sang intent:// (mở Chrome) hoặc window.open.
 * Ép tải lại bằng https trong cùng WebView.
 */
export function resolveIntentUrlForWebView(intentUrl: string): string | null {
  if (!intentUrl.startsWith('intent://')) return null

  const fb = intentUrl.match(/S\.browser_fallback_url=([^;#]+)/i)
  if (fb?.[1]) {
    try {
      return decodeURIComponent(fb[1].replace(/\+/g, ' '))
    } catch {
      /* fall through */
    }
  }

  const hashIdx = intentUrl.indexOf('#')
  const pathPart = hashIdx >= 0 ? intentUrl.slice(9, hashIdx) : intentUrl.slice(9)
  const fragment = hashIdx >= 0 ? intentUrl.slice(hashIdx) : ''
  const sm = fragment.match(/;scheme=([^;]+)/i)
  const scheme = (sm?.[1] || 'https').split('/')[0].toLowerCase()
  if (scheme !== 'http' && scheme !== 'https') return null
  if (!pathPart) return null
  return `${scheme}://${pathPart}`
}
