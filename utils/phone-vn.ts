/** Chuẩn hóa số VN: bỏ khoảng, +84 → 0 */
export function normalizeVietnamPhone(phone: string): string {
  let t = phone.trim().replace(/\s/g, '')
  if (t.startsWith('+84')) t = '0' + t.slice(3)
  return t
}

export function isVietnamPhoneLocal(phone: string): boolean {
  const t = phone.trim().replace(/\s/g, '')
  return /^(0|\+84)\d{9,10}$/.test(t)
}
