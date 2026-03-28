import { api } from '@/lib/api-client'
import { UserProfile, Address, UpdateProfileRequest, AddAddressRequest } from '@/types/user'
import { ApiResponse } from '@/types/api'

export const userService = {
  getProfile: () => api.get<ApiResponse<UserProfile>>('/api/user/profile'),

  updateProfile: (data: UpdateProfileRequest) =>
    api.put<ApiResponse<null>>('/api/user/profile', data),

  getAddresses: () => api.get<ApiResponse<Address[]>>('/api/user/addresses'),

  addAddress: (data: AddAddressRequest) =>
    api.post<ApiResponse<Address>>('/api/user/addresses', data),

  updateAddress: (addressId: string, data: Partial<AddAddressRequest>) =>
    api.put<ApiResponse<null>>(`/api/user/addresses/${addressId}`, data),

  deleteAddress: (addressId: string) =>
    api.delete<ApiResponse<null>>(`/api/user/addresses/${addressId}`),

  setDefaultAddress: (addressId: string) =>
    api.post<ApiResponse<null>>(`/api/user/addresses/${addressId}/set-default`),
}
