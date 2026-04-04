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
  logout: () => void
  setUser: (user: User) => void
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

      logout: () => {
        localStorage.removeItem('token')
        set({ user: null, token: null, isAuthenticated: false })
      },

      setUser: (user) => set({ user }),
    }),
    { name: 'auth-store', partialize: (state) => ({ user: state.user, token: state.token, isAuthenticated: state.isAuthenticated }) }
  )
)
