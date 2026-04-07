import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { User } from '@/types'
import api, { API_BASE_URL } from '@/lib/api'
import axios from 'axios'

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

// ─── Silent refresh timer ─────────────────────────────────────────────────────
let refreshTimer: ReturnType<typeof setTimeout> | null = null

function getTokenExp(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null
  } catch {
    return null
  }
}

function scheduleRefresh(token: string) {
  if (refreshTimer) clearTimeout(refreshTimer)

  const exp = getTokenExp(token)
  if (!exp) return

  // Refresh 2 minutes before expiry
  const delay = exp - Date.now() - 2 * 60 * 1000
  if (delay <= 0) {
    doRefresh()
    return
  }

  refreshTimer = setTimeout(doRefresh, delay)
}

async function doRefresh() {
  try {
    const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {}, { withCredentials: true })
    localStorage.setItem('token', data.token)
    useAuthStore.getState().setSession(data.user, data.token)
    // setSession จะ call scheduleRefresh อีกครั้งอัตโนมัติ
  } catch {
    // refresh token หมดอายุจริง → clear session
    useAuthStore.getState().clearSession()
  }
}

function cancelRefresh() {
  if (refreshTimer) {
    clearTimeout(refreshTimer)
    refreshTimer = null
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────
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
        scheduleRefresh(data.token)
      },

      register: async (registerData) => {
        const { data } = await api.post('/auth/register', registerData)
        localStorage.setItem('token', data.token)
        set({ user: data.user, token: data.token, isAuthenticated: true })
        scheduleRefresh(data.token)
      },

      loginWithToken: async (token) => {
        localStorage.setItem('token', token)
        const { data } = await api.get('/auth/me')
        set({ user: data, token, isAuthenticated: true })
        scheduleRefresh(token)
      },

      logout: async () => {
        cancelRefresh()
        await api.post('/auth/logout').catch(() => {})
        localStorage.removeItem('token')
        set({ user: null, token: null, isAuthenticated: false })
      },

      setUser: (user) => set({ user }),

      setSession: (user, token) => {
        localStorage.setItem('token', token)
        set({ user, token, isAuthenticated: true })
        scheduleRefresh(token)
      },

      clearSession: () => {
        cancelRefresh()
        localStorage.removeItem('token')
        set({ user: null, token: null, isAuthenticated: false })
      },

      initAuth: async () => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
        if (!token) {
          try {
            const { data } = await api.post('/auth/refresh')
            localStorage.setItem('token', data.token)
            set({ user: data.user, token: data.token, isAuthenticated: true })
            scheduleRefresh(data.token)
          } catch {
            set({ user: null, token: null, isAuthenticated: false })
          }
        } else {
          // Token อยู่แล้ว — schedule refresh ตาม expiry ที่เหลือ
          scheduleRefresh(token)
        }
      },
    }),
    {
      name: 'auth-store',
      partialize: (state) => ({ user: state.user, token: state.token, isAuthenticated: state.isAuthenticated }),
    }
  )
)
