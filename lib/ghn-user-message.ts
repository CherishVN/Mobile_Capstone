/**
 * Chuyển lỗi kỹ thuật GHN thành câu phù hợp giao diện người mua
 */
const GENERIC_FEE =
  'Không tính được phí giao hàng. Vui lòng kiểm tra lại địa chỉ (tỉnh / quận / xã) trùng với cách gọi trên mạng GHN, hoặc thử lại sau.'

export function userFacingGhnMessage(technical: string | undefined | null): string {
  if (!technical?.trim()) {
    return GENERIC_FEE
  }
  const t = technical.toLowerCase()

  if (t.includes('serviceid') && (t.includes('required') || t.includes('field validation'))) {
    return 'Dịch vụ vận chuyển (GHN) chưa được cấu hình đúng. Vui lòng thử lại sau hoặc liên hệ hỗ trợ.'
  }

  if (t.includes('route not found') || t.includes('not found service')) {
    return 'GHN chưa có tuyến giao tương ứng với dịch vụ/điểm lấy — gửi hàng. Kiểm tra mã kho (quận/xã) của shop, địa chỉ nhận khớp dữ liệu GHN, hoặc thử đổi gói dịch vụ.'
  }

  if (t.includes('không có dịch vụ nào cho tuyến') && t.includes('kho shop')) {
    return technical.trim()
  }
  if (t.includes('shop chưa cấu hình đủ ghn') || t.includes('cập nhật trong cài đặt shop')) {
    return technical.trim()
  }
  if (t.includes('không tính được phí với mọi dịch vụ trên tuyến') || t.includes('kiểm tra cấu hình kho')) {
    return technical.trim()
  }

  if (t.includes('ward') && (t.includes('not') || t.includes('invalid') || t.includes('mismatch'))) {
    return 'Mã xã / phường không nằm trong vùng GHN giao được. Hãy chọn lại xã tương ứng trên ứng dụng/dữ liệu GHN.'
  }

  if (t.includes('district') && (t.includes('not') || t.includes('invalid'))) {
    return 'Quận / huyện không hợp lệ theo bảng GHN. Hãy chỉnh tên từng cấp cho khớp.'
  }

  if (
    t.includes('corev2_') ||
    t.includes("field validation for '") ||
    t.includes("failed on the '") ||
    t.includes('key:') ||
    t.includes('myrequest')
  ) {
    return GENERIC_FEE
  }

  if (/^\[ghn\s*#\d+\]/i.test(technical.trim()) && (technical.length > 80 || t.includes('error:'))) {
    return GENERIC_FEE
  }

  const trimmed = technical.trim()
  if (trimmed.length > 0 && trimmed.length < 100 && !trimmed.includes('Error:') && !trimmed.includes('Key:')) {
    return trimmed
  }

  return GENERIC_FEE
}
