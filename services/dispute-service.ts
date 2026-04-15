import { api } from '@/lib/api-client'
import type {
  CustomerDisputeListResponse,
  CustomerDisputeResponse,
  CreateDisputeRequest,
} from '@/types/dispute'

export const disputeService = {
  /** Lấy danh sách khiếu nại của tôi */
  getMyDisputes: async (params: { page?: number; pageSize?: number; status?: number } = {}) => {
    const q = new URLSearchParams()
    if (params.page) q.set('page', String(params.page))
    if (params.pageSize) q.set('pageSize', String(params.pageSize))
    if (params.status !== undefined) q.set('status', String(params.status))
    return api.get<CustomerDisputeListResponse>(`/api/disputes${q.toString() ? `?${q}` : ''}`)
  },

  /** Lấy chi tiết một khiếu nại */
  getDisputeById: async (id: string) =>
    api.get<CustomerDisputeResponse>(`/api/disputes/${id}`),

  /** Tạo khiếu nại mới */
  createDispute: async (data: CreateDisputeRequest) =>
    api.post<CustomerDisputeResponse>('/api/disputes', data),

  /** Cập nhật bằng chứng (hoặc gửi phản hồi khi WaitingCustomer) */
  updateEvidence: async (
    disputeId: string,
    evidenceUrls: string[],
    customerNote?: string,
  ) =>
    api.put<CustomerDisputeResponse>(`/api/disputes/${disputeId}/evidence`, {
      evidenceUrls,
      customerNote,
    }),

  /** Hủy khiếu nại */
  cancelDispute: async (disputeId: string) =>
    api.post<CustomerDisputeResponse>(`/api/disputes/${disputeId}/cancel`),
}
