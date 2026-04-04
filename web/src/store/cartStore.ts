import { create } from 'zustand'
import { Cart } from '@/types'
import api from '@/lib/api'

interface CartState {
  cart: Cart | null
  itemCount: number
  fetchCart: () => Promise<void>
  addToCart: (productId: string, quantity: number) => Promise<void>
  updateItem: (itemId: string, quantity: number) => Promise<void>
  removeItem: (itemId: string) => Promise<void>
  clearCart: () => Promise<void>
}

export const useCartStore = create<CartState>((set, get) => ({
  cart: null,
  itemCount: 0,

  fetchCart: async () => {
    const { data } = await api.get('/cart')
    set({ cart: data, itemCount: data.items.length })
  },

  addToCart: async (productId, quantity) => {
    const { data } = await api.post('/cart/items', { productId, quantity })
    set({ cart: data, itemCount: data.items.length })
  },

  updateItem: async (itemId, quantity) => {
    const { data } = await api.put(`/cart/items/${itemId}`, { quantity })
    set({ cart: data, itemCount: data.items.length })
  },

  removeItem: async (itemId) => {
    await api.delete(`/cart/items/${itemId}`)
    await get().fetchCart()
  },

  clearCart: async () => {
    await api.delete('/cart')
    set({ cart: null, itemCount: 0 })
  },
}))
