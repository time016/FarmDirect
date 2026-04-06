'use client'
import Link from 'next/link'
import Image from 'next/image'
import { ShoppingCart, Star } from 'lucide-react'

function avgRating(reviews?: { rating: number }[]) {
  if (!reviews?.length) return 0
  return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
}
import { Product } from '@/types'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'
import { useAuthModalStore } from '@/store/authModalStore'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import toast from 'react-hot-toast'

interface Props {
  product: Product
}

export default function ProductCard({ product }: Props) {
  const { addToCart } = useCartStore()
  const { isAuthenticated, user } = useAuthStore()
  const { openLogin } = useAuthModalStore()

  const { data: myFarm } = useQuery({
    queryKey: ['my-farm'],
    queryFn: () => api.get('/farms/my').then((r) => r.data),
    enabled: isAuthenticated && (user?.role === 'SELLER' || (user?.role === 'ADMIN' || user?.role === 'HOST')),
  })

  const isOwnFarm = !!(myFarm?.id && product.farm?.id === myFarm.id)

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (!isAuthenticated) { openLogin(); return }
    if ((user?.role === 'ADMIN' || user?.role === 'HOST')) { toast.error('แอดมินไม่สามารถสั่งซื้อได้'); return }
    if (isOwnFarm) { toast.error('ไม่สามารถสั่งซื้อสินค้าของฟาร์มตัวเองได้'); return }
    try {
      await addToCart(product.id, 1)
      toast.success('เพิ่มสินค้าในตะกร้าแล้ว')
    } catch {
      toast.error('เกิดข้อผิดพลาด')
    }
  }

  return (
    <Link href={`/products/${product.id}`}>
      <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition overflow-hidden border border-gray-100">
        <div className="relative h-48 bg-gray-100">
          {product.images[0] ? (
            <Image src={product.images[0]} alt={product.name} fill sizes="(max-width:640px) 50vw, (max-width:1024px) 33vw, 25vw" className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-5xl">🌿</div>
          )}
          {product.stock - (product.reservedStock ?? 0) <= 0 && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="text-white font-semibold">สินค้าหมด</span>
            </div>
          )}
        </div>

        <div className="p-3 sm:p-4">
          <p className="text-sm text-green-600 mb-1">{product.farm?.name} · {product.farm?.province}</p>
          <h3 className="font-semibold text-gray-600 line-clamp-1">{product.name}</h3>
          <p className="text-sm text-gray-500 mb-2">{product.category?.name}</p>

          <div className="flex items-center gap-1 text-yellow-400 text-sm mb-2">
            {[1, 2, 3, 4, 5].map((s) => {
              const avg = avgRating(product.reviews)
              return <Star key={s} size={12} fill={s <= Math.round(avg) ? 'currentColor' : 'none'} className={s <= Math.round(avg) ? 'text-yellow-400' : 'text-gray-300'} />
            })}
            <span className="text-gray-500 ml-0.5">({product._count?.reviews ?? 0})</span>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <span className="text-green-700 font-bold text-lg">
                ฿{Number(product.displayPrice ?? product.price).toLocaleString()}
              </span>
              <span className="text-gray-500 text-sm">/{product.unit}</span>
            </div>
            <button
              onClick={handleAddToCart}
              disabled={product.stock - (product.reservedStock ?? 0) <= 0 || isOwnFarm}
              className="bg-green-600 text-white p-2 rounded-lg hover:bg-green-700 transition disabled:opacity-40"
            >
              <ShoppingCart size={16} />
            </button>
          </div>
        </div>
      </div>
    </Link>
  )
}
