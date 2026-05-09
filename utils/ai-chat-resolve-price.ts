import type { ProductSuggestion } from '@/types/ai-chat'

/**
 * Lấy đơn giá hiển thị: ưu tiên giá variant đã chọn (nếu có price),
 * sau đó tới variant duy nhất có price, cuối cùng fallback basePrice.
 * Dùng cho thẻ gợi ý sản phẩm AI và preview xác nhận đơn để khớp với phân loại người dùng chọn.
 */
export function resolveUnitPriceForProduct(
  p: Pick<ProductSuggestion, 'basePrice' | 'variants'>,
  variantId?: string | null
): number {
  const variants = p.variants ?? []
  if (variantId) {
    const matched = variants.find((v) => String(v.id) === String(variantId))
    if (matched?.price != null) return Number(matched.price)
  }
  if (variants.length === 1 && variants[0]?.price != null) return Number(variants[0].price)
  return Number(p.basePrice) || 0
}
