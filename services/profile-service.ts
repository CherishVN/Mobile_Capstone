import { api } from '@/lib/api-client'
import { ApiResponse } from '@/types/api'
import { RegisterSellerRequest, UserProfileResponse } from '@/types/profile'

export const profileService = {
  getProfile: () => api.get<ApiResponse<UserProfileResponse>>('/api/user/profile'),

  registerSeller: (data: RegisterSellerRequest) =>
    api.post<ApiResponse<null>>('/api/user/register-seller', data),
}
