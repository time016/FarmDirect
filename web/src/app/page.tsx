'use client'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import api from '@/lib/api'
import ProductCard from '@/components/ProductCard'
import FarmCard from '@/components/FarmCard'
import { Product, Farm } from '@/types'
import { ArrowRight } from 'lucide-react'

export default function HomePage() {
  const { data: productsData } = useQuery({
    queryKey: ['products', 'bestseller'],
    queryFn: () => api.get('/products?limit=12&sortBy=bestseller').then((r) => r.data),
  })

  const { data: farmsData } = useQuery({
    queryKey: ['farms', 'bestseller'],
    queryFn: () => api.get('/farms?limit=12&sortBy=bestseller').then((r) => r.data),
  })

  return (
    <div className="space-y-12">
      {/* Featured Products */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-600">สินค้าขายดี</h2>
          <Link href="/products" className="text-green-600 text-sm flex items-center gap-1 hover:underline">
            ดูทั้งหมด <ArrowRight size={14} />
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {productsData?.products?.map((p: Product) => <ProductCard key={p.id} product={p} />)}
        </div>
      </section>

      {/* Featured Farms */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-600">ฟาร์มแนะนำ</h2>
          <Link href="/farms" className="text-green-600 text-sm flex items-center gap-1 hover:underline">
            ดูทั้งหมด <ArrowRight size={14} />
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {farmsData?.farms?.map((f: Farm) => <FarmCard key={f.id} farm={f} />)}
        </div>
      </section>
    </div>
  )
}
