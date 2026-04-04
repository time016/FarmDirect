'use client'
import { useState, Suspense } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import api from '@/lib/api'
import ProductCard from '@/components/ProductCard'
import { Product, Category } from '@/types'
import { Search, X } from 'lucide-react'

function ProductsContent() {
  const searchParams = useSearchParams()
  const [search, setSearch] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    searchParams.get('categoryId') ? [searchParams.get('categoryId')!] : []
  )
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['products', { search, selectedCategories, page }],
    queryFn: () => api.get('/products', {
      params: {
        search: search || undefined,
        categoryId: selectedCategories.length > 0 ? selectedCategories.join(',') : undefined,
        page,
        limit: 12,
      },
    }).then((r) => r.data),
  })

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then((r) => r.data),
  })

  const toggleCategory = (id: string) => {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    )
    setPage(1)
  }

  const clearFilters = () => {
    setSearch('')
    setSelectedCategories([])
    setPage(1)
  }

  const hasFilters = search !== '' || selectedCategories.length > 0

  return (
    <div className="space-y-6">
      {/* Title + Search */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-600 flex-shrink-0">สินค้าทั้งหมด</h1>
        <div className="flex items-center gap-2 sm:ml-auto w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search size={16} className="absolute left-3 top-3 text-gray-500" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              placeholder="ค้นหาสินค้า..."
              className="w-full sm:w-64 pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex-shrink-0 flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 px-3 py-2 rounded-lg transition"
            >
              <X size={14} /> ล้างตัวกรอง
            </button>
          )}
        </div>
      </div>

      {/* Category checkboxes */}
        {categories && categories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => {
              const checked = selectedCategories.includes(c.id)
              return (
                <label
                  key={c.id}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm cursor-pointer select-none transition ${
                    checked
                      ? 'bg-green-600 border-green-600 text-white'
                      : 'bg-white border-gray-300 text-gray-700 hover:border-green-400 hover:text-green-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={checked}
                    onChange={() => toggleCategory(c.id)}
                  />
                  {checked && <X size={12} />}
                  {c.name}
                  {c._count?.products != null && (
                    <span className={`text-sm ${checked ? 'text-green-100' : 'text-gray-500'}`}>
                      ({c._count.products})
                    </span>
                  )}
                </label>
              )
            })}
          </div>
        )}

      {/* Products Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-xl h-64 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {data?.products?.map((p: Product) => <ProductCard key={p.id} product={p} />)}
          </div>
          {data?.products?.length === 0 && (
            <div className="text-center py-16 text-gray-500">ไม่พบสินค้า</div>
          )}
          {/* Pagination */}
          {data?.totalPages > 1 && (
            <div className="flex justify-center gap-2">
              {Array.from({ length: data.totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p} onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-full text-sm ${page === p ? 'bg-green-600 text-white' : 'bg-white border text-gray-700'}`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function ProductsPage() {
  return <Suspense><ProductsContent /></Suspense>
}
