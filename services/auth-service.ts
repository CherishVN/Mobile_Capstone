import { supabase } from '@/lib/supabase'
import { ApiError } from '@/types/api'

export interface SignUpData {
  email: string
  password: string
  fullName: string
}

export interface SignInData {
  email: string
  password: string
}

export const authService = {
  signUp: async (data: SignUpData) => {
    const { data: authData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: data.fullName,
        },
      },
    })

    if (error) {
      throw { message: error.message, statusCode: 400 } as ApiError
    }

    return authData
  },

  signIn: async (data: SignInData) => {
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })

    if (error) {
      throw { message: error.message, statusCode: 401 } as ApiError
    }

    return authData
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      throw { message: error.message } as ApiError
    }
  },

  resetPassword: async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    if (error) {
      throw { message: error.message } as ApiError
    }
  },

  updatePassword: async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    })
    if (error) {
      throw { message: error.message } as ApiError
    }
  },
}
