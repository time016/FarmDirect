'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Search, UserPlus, Trash2, Users, Crown } from 'lucide-react'

interface FarmAdminUser {
  id: string
  name: string
  email: string
  avatar?: string
  role: string
}

interface FarmAdmin {
  id: string
  userId: string
  status: 'PENDING' | 'ACCEPTED'
  createdAt: string
  user: FarmAdminUser
}

interface SearchUser {
  id: string
  name: string
  email: string
  avatar?: string
  role: string
}

export default function SellerAdminsPage() {
  const qc = useQueryClient()
  const [searchQ, setSearchQ] = useState('')
  const [confirmRemove, setConfirmRemove] = useState<FarmAdmin | null>(null)

  const { data: admins = [], isLoading } = useQuery<FarmAdmin[]>({
    queryKey: ['my-farm-admins'],
    queryFn: () => api.get('/farms/admins').then((r) => r.data),
  })

  const { data: searchResults = [] } = useQuery<SearchUser[]>({
    queryKey: ['farm-admin-search', searchQ],
    queryFn: () => api.get('/farms/admins/search-users', { params: { q: searchQ } }).then((r) => r.data),
    enabled: searchQ.trim().length >= 2,
  })

  const addMutation = useMutation({
    mutationFn: (userId: string) => api.post('/farms/admins', { userId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-farm-admins'] })
      setSearchQ('')
    },
  })

  const removeMutation = useMutation({
    mutationFn: (userId: string) => api.delete(`/farms/admins/${userId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-farm-admins'] })
      setConfirmRemove(null)
    },
  })

  const alreadyAdminIds = new Set(admins.map((a) => a.userId))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-600">ทีมแอดมินฟาร์ม</h1>
      </div>

      {/* Search & invite */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
        <h2 className="font-semibold text-gray-600 flex items-center gap-2">
          <UserPlus size={16} />
          เชิญสมาชิก
        </h2>
        <p className="text-sm text-gray-500 -mt-2">ค้นหาสมาชิกจากชื่อหรืออีเมล เพื่อเพิ่มให้ช่วยจัดการฟาร์ม</p>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-500" />
          <input
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="ค้นหาชื่อหรืออีเมลสมาชิก..."
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white text-gray-700 placeholder:text-gray-500"
          />
        </div>

        {searchQ.trim().length >= 2 && searchResults.length > 0 && (
          <div className="border border-gray-100 rounded-xl divide-y divide-gray-50 overflow-hidden">
            {searchResults.map((u) => {
              const isAdmin = alreadyAdminIds.has(u.id)
              return (
                <div key={u.id} className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50">
                  <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-semibold flex-shrink-0 overflow-hidden">
                    {u.avatar ? (
                      <img src={u.avatar} alt={u.name} className="w-full h-full object-cover" />
                    ) : (
                      u.name[0]?.toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-700 truncate">{u.name}</p>
                    <p className="text-sm text-gray-500 truncate">{u.email}</p>
                  </div>
                  <button
                    onClick={() => !isAdmin && addMutation.mutate(u.id)}
                    disabled={isAdmin || addMutation.isPending}
                    className={`text-sm px-4 py-1.5 rounded-lg font-medium transition ${
                      isAdmin
                        ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    {isAdmin ? 'เป็นแอดมินแล้ว' : 'เชิญ'}
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {searchQ.trim().length >= 2 && searchResults.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-2">ไม่พบสมาชิก</p>
        )}

        {addMutation.isError && (
          <p className="text-sm text-red-500">{(addMutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'เกิดข้อผิดพลาด'}</p>
        )}
      </div>

      {/* Admin list */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
          <Users size={16} className="text-gray-600" />
          <span className="font-semibold text-gray-600">แอดมินปัจจุบัน</span>
          <span className="ml-auto text-sm text-gray-500">{admins.length} คน</span>
        </div>

        {isLoading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : admins.length === 0 ? (
          <div className="text-center py-14">
            <Users size={40} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500">ยังไม่มีแอดมินฟาร์ม</p>
            <p className="text-sm text-gray-300 mt-1">ค้นหาและเชิญสมาชิกด้านบน</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {admins.map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-semibold flex-shrink-0 overflow-hidden">
                  {a.user.avatar ? (
                    <img src={a.user.avatar} alt={a.user.name} className="w-full h-full object-cover" />
                  ) : (
                    a.user.name[0]?.toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-gray-700 truncate">{a.user.name}</p>
                    <span className="text-sm px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 flex-shrink-0">
                      {a.user.role === 'SELLER' ? 'ผู้ขาย' : a.user.role === 'ADMIN' ? 'แอดมิน' : 'ผู้ซื้อ'}
                    </span>
                    {a.status === 'PENDING' && (
                      <span className="text-sm px-2 py-0.5 rounded-full bg-orange-50 text-orange-500 flex-shrink-0">รอตอบรับ</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 truncate">{a.user.email}</p>
                </div>
                <button
                  onClick={() => setConfirmRemove(a)}
                  className="text-gray-500 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Owner note */}
      <div className="flex items-start gap-2 text-sm text-gray-500 bg-gray-50 rounded-xl px-4 py-3">
        <Crown size={15} className="mt-0.5 flex-shrink-0 text-yellow-500" />
        <span>คุณคือเจ้าของฟาร์ม มีสิทธิ์จัดการแอดมินทั้งหมด แอดมินที่คุณเพิ่มสามารถจัดการสินค้าและออเดอร์ได้ แต่ไม่สามารถเพิ่มหรือลบแอดมินคนอื่น</span>
      </div>

      {/* Confirm remove modal */}
      {confirmRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 mx-4 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">ลบแอดมิน</h3>
            <p className="text-sm text-gray-600 mb-5">
              ต้องการลบ <span className="font-medium text-gray-700">{confirmRemove.user.name}</span> ออกจากทีมแอดมินฟาร์มใช่ไหม?
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmRemove(null)}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => removeMutation.mutate(confirmRemove.userId)}
                disabled={removeMutation.isPending}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {removeMutation.isPending ? 'กำลังลบ...' : 'ลบออก'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
