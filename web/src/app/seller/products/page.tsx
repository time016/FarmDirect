'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'
import { Product } from '@/types'
import { Plus, Edit, EyeOff, Eye } from 'lucide-react'
import toast from 'react-hot-toast'

export default function SellerProductsPage() {
  const { isAuthenticated, user } = useAuthStore()
  const router = useRouter()
  const qc = useQueryClient()

  useEffect(() => {
    if (!isAuthenticated) router.push('/')
  }, [isAuthenticated, user])

  const { data: farm, isLoading } = useQuery({
    queryKey: ['my-farm'],
    queryFn: () => api.get('/farms/my').then((r) => r.data),
    enabled: isAuthenticated,
  })

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api.put(`/products/${id}`, { isActive }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-farm'] }); toast.success('อัปเดตแล้ว') },
  })

  if (isLoading) return <div className="animate-pulse bg-gray-100 h-64 rounded-xl" />

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-600">จัดการสินค้า</h1>
        <Link href="/seller/products/new"
          className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition">
          <Plus size={16} /> เพิ่มสินค้า
        </Link>
      </div>

      {!farm ? (
        <div className="text-center py-20 text-gray-500">
          <p className="mb-4">กรุณาสร้างฟาร์มก่อน</p>
          <Link href="/seller/farm/create" className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition">สร้างฟาร์ม</Link>
        </div>
      ) : farm.products?.length === 0 ? (
        <div className="text-center py-20 text-gray-500">ยังไม่มีสินค้า</div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {farm.products?.map((p: Product) => (
              <div key={p.id} className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center gap-3">
                {/* Image */}
                <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                  {(p.images as string[])?.[0] ? (
                    <Image src={(p.images as string[])[0]} alt={p.name} fill sizes="48px" className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xl">🌿</div>
                  )}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-700 truncate">{p.name}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-sm font-semibold text-green-700">฿{Number(p.price).toLocaleString()}/{p.unit}</span>
                    <span className={`text-sm ${p.stock <= 5 ? 'text-red-500 font-medium' : 'text-gray-500'}`}>สต็อก {p.stock}</span>
                    <span className={`text-sm px-1.5 py-0.5 rounded-full ${p.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {p.isActive ? 'เปิดขาย' : 'ปิด'}
                    </span>
                  </div>
                </div>
                {/* Actions */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <Link href={`/seller/products/${p.id}/edit`} className="text-blue-500 hover:text-blue-700 transition p-1">
                    <Edit size={17} />
                  </Link>
                  <button onClick={() => toggleActive.mutate({ id: p.id, isActive: !p.isActive })}
                    className={`transition p-1 ${p.isActive ? 'text-gray-500 hover:text-red-500' : 'text-green-500 hover:text-green-700'}`}>
                    {p.isActive ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="text-left px-5 py-3">สินค้า</th>
                  <th className="text-right px-5 py-3">ราคา</th>
                  <th className="text-right px-5 py-3">สต็อก</th>
                  <th className="text-center px-5 py-3">สถานะ</th>
                  <th className="text-center px-5 py-3">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {farm.products?.map((p: Product) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                          {(p.images as string[])?.[0] ? (
                            <Image src={(p.images as string[])[0]} alt={p.name} fill sizes="40px" className="object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-lg">🌿</div>
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-600">{p.name}</p>
                          <p className="text-sm text-gray-500">{p.category?.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right font-medium text-green-700">
                      ฿{Number(p.price).toLocaleString()}/{p.unit}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className={p.stock <= 5 ? 'text-red-500 font-medium' : 'text-gray-700'}>{p.stock}</span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className={`text-sm px-2 py-1 rounded-full ${p.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {p.isActive ? 'เปิดขาย' : 'ปิด'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex justify-center gap-2">
                        <Link href={`/seller/products/${p.id}/edit`} className="text-blue-500 hover:text-blue-700 transition">
                          <Edit size={15} />
                        </Link>
                        <button onClick={() => toggleActive.mutate({ id: p.id, isActive: !p.isActive })}
                          className={`transition ${p.isActive ? 'text-gray-500 hover:text-red-500' : 'text-green-500 hover:text-green-700'}`}>
                          {p.isActive ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
