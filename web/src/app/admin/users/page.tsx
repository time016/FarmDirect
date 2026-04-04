'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'
import { User, Role } from '@/types'
import { Search, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

const PAGE_SIZE = 20

interface AdminUsersPage {
  users: User[]
  total: number
  page: number
  totalPages: number
}

const roleLabel: Record<Role, string> = { BUYER: 'ผู้ซื้อ', SELLER: 'ผู้ขาย', ADMIN: 'แอดมิน' }
const roleColor: Record<Role, string> = {
  BUYER: 'bg-blue-100 text-blue-700',
  SELLER: 'bg-green-100 text-green-700',
  ADMIN: 'bg-purple-100 text-purple-700',
}

export default function AdminUsersPage() {
  const { isAuthenticated, user } = useAuthStore()
  const router = useRouter()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'ADMIN') router.push('/')
  }, [isAuthenticated, user])

  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } = useInfiniteQuery<AdminUsersPage>({
    queryKey: ['admin-users', { search, roleFilter }],
    queryFn: ({ pageParam = 1 }) =>
      api.get('/admin/users', {
        params: { search, role: roleFilter || undefined, page: pageParam, limit: PAGE_SIZE },
      }).then((r) => r.data),
    initialPageParam: 1,
    getNextPageParam: (last) => last.page < last.totalPages ? last.page + 1 : undefined,
    enabled: isAuthenticated && user?.role === 'ADMIN',
  })

  const users: User[] = data?.pages.flatMap((p) => p.users) ?? []
  const total = data?.pages[0]?.total ?? 0

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage() },
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api.put(`/admin/users/${id}`, { isActive }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); toast.success('อัปเดตแล้ว') },
  })

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-extrabold text-gray-600">จัดการผู้ใช้</h1>
        <span className="text-sm text-gray-600">ทั้งหมด {total} คน</span>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อ / อีเมล..."
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm" />
        </div>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 sm:w-36">
          <option value="">ทุก Role</option>
          <option value="BUYER">ผู้ซื้อ</option>
          <option value="SELLER">ผู้ขาย</option>
          <option value="ADMIN">แอดมิน</option>
        </select>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="bg-gray-100 h-16 rounded-xl animate-pulse" />)}</div>
      ) : users.length === 0 ? (
        <div className="text-center py-12 text-gray-500">ไม่พบผู้ใช้</div>
      ) : (
        <>
          {/* Mobile: card layout */}
          <div className="space-y-3 sm:hidden">
            {users.map((u: User) => (
              <div key={u.id} className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{u.name}</p>
                    <p className="text-sm text-gray-600 truncate mt-0.5">{u.email}</p>
                    {u.phone && <p className="text-sm text-gray-500 mt-0.5">{u.phone}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <span className={`text-sm px-2 py-0.5 rounded-full font-medium ${roleColor[u.role]}`}>{roleLabel[u.role]}</span>
                    <span className={`text-sm px-2 py-0.5 rounded-full ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-500'}`}>
                      {u.isActive ? 'ใช้งาน' : 'ถูกปิด'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => toggleActive.mutate({ id: u.id, isActive: !u.isActive })}
                  disabled={u.id === user?.id}
                  className={`w-full text-sm py-2 rounded-lg transition disabled:opacity-30 font-medium ${u.isActive ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}
                >
                  {u.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                </button>
              </div>
            ))}
          </div>

          {/* Tablet/PC: table layout */}
          <div className="hidden sm:block bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="text-left px-5 py-3">ชื่อ</th>
                  <th className="text-left px-5 py-3 max-w-[200px]">อีเมล</th>
                  <th className="text-left px-5 py-3 hidden md:table-cell">เบอร์</th>
                  <th className="text-center px-5 py-3">Role</th>
                  <th className="text-center px-5 py-3">สถานะ</th>
                  <th className="text-center px-5 py-3">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u: User) => (
                  <tr key={u.id} className="hover:bg-gray-50 transition">
                    <td className="px-5 py-4 font-semibold text-gray-900">{u.name}</td>
                    <td className="px-5 py-4 text-gray-700 max-w-[200px] break-all">{u.email}</td>
                    <td className="px-5 py-4 text-gray-600 hidden md:table-cell">{u.phone || '-'}</td>
                    <td className="px-5 py-4 text-center">
                      <span className={`text-sm px-2 py-1 rounded-full font-medium ${roleColor[u.role]}`}>{roleLabel[u.role]}</span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className={`text-sm px-2 py-1 rounded-full ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-500'}`}>
                        {u.isActive ? 'ใช้งาน' : 'ถูกปิด'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <button
                        onClick={() => toggleActive.mutate({ id: u.id, isActive: !u.isActive })}
                        disabled={u.id === user?.id}
                        className={`text-sm px-3 py-1 rounded-lg transition disabled:opacity-30 ${u.isActive ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                      >
                        {u.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} className="h-4" />
          {isFetchingNextPage && (
            <div className="flex justify-center py-4 text-gray-500">
              <Loader2 size={20} className="animate-spin" />
            </div>
          )}
          {!hasNextPage && users.length > PAGE_SIZE && (
            <p className="text-center text-sm text-gray-500 py-3">แสดงทั้งหมด {users.length} รายการ</p>
          )}
        </>
      )}
    </div>
  )
}
