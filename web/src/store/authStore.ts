import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { User } from '@/types'
import api from '@/lib/api'

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  register: (data: RegisterData) => Promise<void>
  loginWithToken: (token: string) => Promise<void>
  logout: () => Promise<void>
  setUser: (user: User) => void
  setSession: (user: User, token: string) => void
  clearSession: () => void
  initAuth: () => Promise<void>
}

interface RegisterData {
  email: string
  password: string
  name: string
  phone?: string
  role?: 'BUYER' | 'SELLER'
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: async (email, password) => {
        const { data } = await api.post('/auth/login', { email, password })
        localStorage.setItem('token', data.token)
        set({ user: data.user, token: data.token, isAuthenticated: true })
      },

      register: async (registerData) => {
        const { data } = await api.post('/auth/register', registerData)
        localStorage.setItem('token', data.token)
        set({ user: data.user, token: data.token, isAuthenticated: true })
      },

      loginWithToken: async (token) => {
        localStorage.setItem('token', token)
        const { data } = await api.get('/auth/me')
        set({ user: data, token, isAuthenticated: true })
      },

      logout: async () => {
        await api.post('/auth/logout').catch(() => {})
        localStorage.removeItem('token')
        set({ user: null, token: null, isAuthenticated: false })
      },

      setUser: (user) => set({ user }),

      setSession: (user, token) => {
        localStorage.setItem('token', token)
        set({ user, token, isAuthenticated: true })
      },

      clearSession: () => {
        localStorage.removeItem('token')
        set({ user: null, token: null, isAuthenticated: false })
      },

      initAuth: async () => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
        if (!token) {
          // No access token — try refresh cookie
          try {
            const { data } = await api.post('/auth/refresh')
            localStorage.setItem('token', data.token)
            set({ user: data.user, token: data.token, isAuthenticated: true })
          } catch {
            set({ user: null, token: null, isAuthenticated: false })
          }
        }
      },
    }),
    {
      name: 'auth-store',
      partialize: (state) => ({ user: state.user, token: state.token, isAuthenticated: state.isAuthenticated }),
    }
  )
)
