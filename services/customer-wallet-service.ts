import { api } from '@/lib/api-client'

export interface CustomerWalletDto {
  id?: string
  availableBalance: number
  totalRefunded: number
  totalWithdrawn: number
  updatedAt: string
}

export interface CustomerWalletLedgerItem {
  id: string
  type: 'refund' | 'withdrawal' | string
  amount: number
  referenceType?: string
  referenceId?: string
  note?: string
  createdAt: string
}

export interface CustomerWalletLedgerResponse {
  success: boolean
  message?: string
  transactions: CustomerWalletLedgerItem[]
  totalCount: number
  page: number
  pageSize: number
}

export interface CreateCustomerWithdrawalDto {
  amount: number
  bankName: string
  bankAccountNumber: string
  bankAccountName: string
}

export interface CustomerWithdrawalRequestDto {
  id: string
  amount: number
  bankName: string
  bankAccountNumber: string
  bankAccountName: string
  status: 0 | 1 | 2 | 3
  statusName: string
  rejectionReason?: string
  adminNote?: string
  requestedAt: string
  reviewedAt?: string
  paidAt?: string
}

export interface CustomerWithdrawalListResponse {
  success: boolean
  message?: string
  requests: CustomerWithdrawalRequestDto[]
  totalCount: number
  page: number
  pageSize: number
}

export interface CustomerWithdrawalResponse {
  success: boolean
  message?: string
  request?: CustomerWithdrawalRequestDto
}

interface WalletApiResponse {
  success: boolean
  data: CustomerWalletDto
}

export const customerWalletService = {
  getWallet: () =>
    api.get<WalletApiResponse>('/api/customer-wallet'),

  getTransactions: (page = 1, pageSize = 30) =>
    api.get<CustomerWalletLedgerResponse>(
      `/api/customer-wallet/transactions?page=${page}&pageSize=${pageSize}`
    ),

  createWithdrawalRequest: (dto: CreateCustomerWithdrawalDto) =>
    api.post<CustomerWithdrawalResponse>('/api/customer-wallet/withdrawal-requests', dto),

  getWithdrawalRequests: (page = 1, pageSize = 30) =>
    api.get<CustomerWithdrawalListResponse>(
      `/api/customer-wallet/withdrawal-requests?page=${page}&pageSize=${pageSize}`
    ),
}
