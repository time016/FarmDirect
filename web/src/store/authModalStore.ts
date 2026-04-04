import { create } from 'zustand'

type Mode = 'login' | 'register'

interface AuthModalStore {
  isOpen: boolean
  mode: Mode
  initialRole: 'BUYER' | 'SELLER'
  openLogin: () => void
  openRegister: (role?: 'BUYER' | 'SELLER') => void
  close: () => void
}

export const useAuthModalStore = create<AuthModalStore>((set) => ({
  isOpen: false,
  mode: 'login',
  initialRole: 'BUYER',
  openLogin: () => set({ isOpen: true, mode: 'login' }),
  openRegister: (role = 'BUYER') => set({ isOpen: true, mode: 'register', initialRole: role }),
  close: () => set({ isOpen: false }),
}))
