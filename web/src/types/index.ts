export type Role = 'BUYER' | 'SELLER' | 'ADMIN' | 'HOST'
export type OrderStatus = 'PENDING' | 'PAID' | 'CONFIRMED' | 'SHIPPING' | 'DELIVERED' | 'CANCELLED'
export type PaymentMethod = 'PROMPTPAY' | 'CREDIT_CARD' | 'BANK_TRANSFER'
export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED'

export interface User {
  id: string
  email: string
  name: string
  phone?: string
  avatar?: string
  role: Role
  isActive: boolean
  emailVerified: boolean
  createdAt: string
}

export interface Farm {
  id: string
  slug?: string | null
  userId: string
  name: string
  description?: string
  location: string
  province: string
  image?: string
  images?: string[]
  videos?: string[]
  isVerified: boolean
  isSuspended: boolean
  rejectReason?: string | null
  shippingRate?: number | null
  createdAt: string
  user?: { name: string; phone?: string }
  products?: Product[]
  farmReviews?: { rating: number }[]
  _count?: { products: number; farmLikes?: number }
}

export interface Category {
  id: string
  name: string
  image?: string
  isActive: boolean
  _count?: { products: number }
}

export interface Product {
  id: string
  farmId: string
  categoryId: string
  name: string
  description?: string
  price: number
  displayPrice?: number  // ราคาที่ลูกค้าจ่ายจริง (หลัง commission + VAT)
  unit: string
  stock: number
  reservedStock?: number
  weightKg?: number
  images: string[]
  isActive: boolean
  createdAt: string
  farm?: { id: string; slug?: string | null; name: string; province: string; shippingRate?: number | null }
  category?: Category
  reviews?: (Review | { rating: number })[]
  _count?: { reviews: number }
}

export interface CartItem {
  id: string
  cartId: string
  productId: string
  quantity: number
  product: Product
}

export interface Cart {
  id: string
  userId: string
  items: CartItem[]
}

export interface Address {
  id: string
  userId: string
  label: string
  recipient: string
  phone: string
  address: string
  subdistrict: string
  district: string
  province: string
  zipCode: string
  isDefault: boolean
}

export interface OrderItem {
  id: string
  orderId: string
  productId: string
  quantity: number
  price: number
  product: Product
}

export interface Order {
  id: string
  userId: string
  addressId: string
  status: OrderStatus
  totalAmount: number
  shippingFee: number
  note?: string
  cancelNote?: string
  trackingNumber?: string
  createdAt: string
  items: OrderItem[]
  address: Address
  payment?: Payment
  user?: { name: string; email: string; phone?: string }
}

export interface Payment {
  id: string
  orderId: string
  method: PaymentMethod
  status: PaymentStatus
  amount: number
  transactionId?: string
  paidAt?: string
  createdAt: string
}

export interface Review {
  id: string
  userId: string
  productId: string
  rating: number
  comment?: string
  images: string[]
  createdAt: string
  user?: { name: string; avatar?: string }
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  totalPages: number
}
