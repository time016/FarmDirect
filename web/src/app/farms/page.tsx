'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import FarmCard from '@/components/FarmCard'
import { Farm } from '@/types'
import { Search, X } from 'lucide-react'

export default function FarmsPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['farms', { search, page }],
    queryFn: () => api.get('/farms', { params: { search, page, limit: 12 } }).then((r) => r.data),
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-600 flex-shrink-0">ฟาร์มทั้งหมด</h1>
        <div className="flex items-center gap-2 sm:ml-auto w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search size={16} className="absolute left-3 top-3 text-gray-500" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              placeholder="ค้นหาฟาร์ม..."
              className="w-full sm:w-64 pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          {search && (
            <button
              onClick={() => { setSearch(''); setPage(1) }}
              className="flex-shrink-0 flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 px-3 py-2 rounded-lg transition"
            >
              <X size={14} /> ล้างตัวกรอง
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="bg-gray-100 rounded-xl h-48 animate-pulse" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {data?.farms?.map((f: Farm) => <FarmCard key={f.id} farm={f} />)}
          </div>
          {data?.farms?.length === 0 && <div className="text-center py-16 text-gray-500">ไม่พบฟาร์ม</div>}
          {data?.totalPages > 1 && (
            <div className="flex justify-center gap-2">
              {Array.from({ length: data.totalPages }, (_, i) => i + 1).map((p) => (
                <button key={p} onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-full text-sm ${page === p ? 'bg-green-600 text-white' : 'bg-white border text-gray-700'}`}>
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
