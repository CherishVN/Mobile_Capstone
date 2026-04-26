// ---------- Dispute Status ----------
export const DisputeStatus = {
  Pending: 0,
  UnderReview: 1,
  WaitingSeller: 2,
  WaitingCustomer: 3,
  Resolved: 4,
  Rejected: 5,
  Refunded: 6,
  Cancelled: 7,
} as const

export type DisputeStatusValue = (typeof DisputeStatus)[keyof typeof DisputeStatus]

export const DisputeStatusLabels: Record<number, string> = {
  [DisputeStatus.Pending]: 'Chờ xử lý',
  [DisputeStatus.UnderReview]: 'Đang xem xét',
  [DisputeStatus.WaitingSeller]: 'Chờ seller',
  [DisputeStatus.WaitingCustomer]: 'Chờ bạn phản hồi',
  [DisputeStatus.Resolved]: 'Đã giải quyết',
  [DisputeStatus.Rejected]: 'Từ chối',
  [DisputeStatus.Refunded]: 'Đã hoàn tiền',
  [DisputeStatus.Cancelled]: 'Đã hủy',
}

export const DisputeStatusColors: Record<number, string> = {
  [DisputeStatus.Pending]: '#f59e0b',
  [DisputeStatus.UnderReview]: '#3b82f6',
  [DisputeStatus.WaitingSeller]: '#f97316',
  [DisputeStatus.WaitingCustomer]: '#6366f1',
  [DisputeStatus.Resolved]: '#22c55e',
  [DisputeStatus.Rejected]: '#ef4444',
  [DisputeStatus.Refunded]: '#8b5cf6',
  [DisputeStatus.Cancelled]: '#9ca3af',
}

// ---------- Dispute Type ----------
export const DisputeType = {
  Refund: 0,
  Return: 1,
  Damaged: 2,
  NotReceived: 3,
  WrongItem: 4,
  QualityIssue: 5,
  Other: 6,
} as const

export const DisputeTypeLabels: Record<number, string> = {
  [DisputeType.Refund]: 'Hoàn tiền',
  [DisputeType.Return]: 'Trả hàng',
  [DisputeType.Damaged]: 'Hàng hư hỏng',
  [DisputeType.NotReceived]: 'Không nhận được',
  [DisputeType.WrongItem]: 'Sai hàng',
  [DisputeType.QualityIssue]: 'Chất lượng không đảm bảo',
  [DisputeType.Other]: 'Khác',
}

// ---------- Customer Dispute Types ----------
export type CustomerDispute = {
  id: string
  orderId: string
  shopId: string
  shopName: string
  type: number
  typeName: string
  status: number
  statusName: string
  title: string
  reason: string
  requestedAmount: number
  approvedAmount: number | null
  resolution: string | null
  evidenceUrls: string[]
  sellerEvidenceUrls: string[]
  sellerResponse: string | null
  sellerRespondedAt: string | null
  createdAt: string
  updatedAt: string
  canUpdateEvidence: boolean
  customerNote: string | null
}

export type CustomerDisputeListResponse = {
  success: boolean
  message?: string | null
  disputes: CustomerDispute[]
  totalCount: number
  page: number
  pageSize: number
}

export type CustomerDisputeResponse = {
  success: boolean
  message?: string | null
  dispute?: CustomerDispute
}

export type CreateDisputeRequest = {
  orderId: string
  type: number
  title: string
  reason: string
  requestedAmount: number
  evidenceUrls?: string[]
  /** Bắt buộc — khớp BE / FE: ít nhất một dòng hàng. */
  items: { orderItemId: string; quantity: number }[]
}

// Các trạng thái customer được phép hủy
export const CANCELLABLE_DISPUTE_STATUSES = new Set<number>([
  DisputeStatus.Pending,
  DisputeStatus.WaitingSeller,
  DisputeStatus.WaitingCustomer,
])
