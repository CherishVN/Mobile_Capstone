/** Đồng bộ logic với FE `lib/formatters` (cửa hàng) */

export function formatCompactNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`
  return String(n)
}

type JoinTimeOptions = {
  unknownLabel?: string
  justJoinedLabel?: string
  todayLabel?: string
  textCase?: 'lower' | 'title'
}

export function formatJoinTime(dateStr?: string | null, options: JoinTimeOptions = {}): string {
  const {
    unknownLabel = 'Đang cập nhật',
    justJoinedLabel = 'Vừa tham gia',
    todayLabel = 'Hôm nay',
    textCase = 'lower',
  } = options
  if (!dateStr) return unknownLabel
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return unknownLabel
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  if (diff < 0) return justJoinedLabel
  const days = Math.floor(diff / (24 * 60 * 60 * 1000))
  if (days < 1) return todayLabel
  const words =
    textCase === 'title'
      ? { day: 'Ngày Trước', week: 'Tuần Trước', month: 'Tháng Trước', year: 'Năm Trước' }
      : { day: 'ngày trước', week: 'tuần trước', month: 'tháng trước', year: 'năm trước' }
  if (days < 7) return `${days} ${words.day}`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks} ${words.week}`
  const years = Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000))
  if (years > 0) return `${years} ${words.year}`
  const months = Math.floor(diff / (30 * 24 * 60 * 60 * 1000))
  if (months > 0) return `${months} ${words.month}`
  return justJoinedLabel
}
