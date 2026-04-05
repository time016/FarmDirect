'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useInfiniteQuery, useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'
import { Farm } from '@/types'
import { CheckCircle, XCircle, ExternalLink, Search, Star, Heart, Package, Loader2, History, X, ShoppingBag, TrendingUp } from 'lucide-react'
import toast from 'react-hot-toast'
import ConfirmDialog from '@/components/ConfirmDialog'

const PAGE_SIZE = 20

type StatusFilter = '' | 'pending' | 'verified' | 'rejected' | 'suspended'

const statusTabs: { key: StatusFilter; label: string }[] = [
  { key: '', label: 'ทั้งหมด' },
  { key: 'pending', label: 'รอยืนยัน' },
  { key: 'verified', label: 'อนุมัติแล้ว' },
  { key: 'rejected', label: 'ถูกปฏิเสธ' },
  { key: 'suspended', label: 'ระงับ' },
]

interface AdminFarm extends Omit<Farm, 'isSuspended'> {
  isSuspended: boolean
  user?: { name: string; email: string; phone?: string }
  _count?: { products: number; farmLikes: number; farmReviews: number }
  orderCount: number
  revenue: number
}

interface PageData {
  farms: AdminFarm[]
  total: number
  page: number
  totalPages: number
  statusCounts: { all: number; verified: number; pending: number; rejected: number; suspended: number }
}


export default function AdminFarmsPage() {
  const { isAuthenticated, user } = useAuthStore()
  const router = useRouter()
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null)
  const [revokeReason, setRevokeReason] = useState('')
  const [logFarmId, setLogFarmId] = useState<string | null>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'ADMIN' && user?.role !== 'HOST') router.push('/')
  }, [isAuthenticated, user])

  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } = useInfiniteQuery<PageData>({
    queryKey: ['admin-farms', statusFilter, search],
    queryFn: ({ pageParam = 1 }) =>
      api.get('/admin/farms', {
        params: {
          status: statusFilter || undefined,
          search: search || undefined,
          page: pageParam,
          limit: PAGE_SIZE,
        },
      }).then((r) => r.data),
    initialPageParam: 1,
    getNextPageParam: (last) => last.page < last.totalPages ? last.page + 1 : undefined,
    enabled: isAuthenticated && (user?.role === 'ADMIN' || user?.role === 'HOST'),
  })

  const farms = data?.pages.flatMap((p) => p.farms) ?? []
  const statusCounts = data?.pages[0]?.statusCounts
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

  const verifyFarm = useMutation({
    mutationFn: ({ id, isVerified, reason }: { id: string; isVerified: boolean; reason?: string }) =>
      api.put(`/admin/farms/${id}/verify`, { isVerified, reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-farms'] })
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] })
      toast.success('อัปเดตแล้ว')
      setRejectingId(null)
      setRejectReason('')
    },
    onError: () => toast.error('เกิดข้อผิดพลาด'),
  })

  const handleReject = (id: string) => {
    if (rejectingId === id) {
      verifyFarm.mutate({ id, isVerified: false, reason: rejectReason })
    } else {
      setRejectingId(id)
      setRejectReason('')
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput)
  }

  const { data: approvalLogs, isLoading: logsLoading } = useQuery({
    queryKey: ['farm-approval-logs', logFarmId],
    queryFn: () => api.get(`/farms/${logFarmId}/approval-logs`).then((r) => r.data),
    enabled: !!logFarmId,
  })

  const actionLabel: Record<string, { label: string; color: string }> = {
    SUBMITTED: { label: 'ยื่นขออนุมัติ', color: 'bg-blue-100 text-blue-700' },
    APPROVED:  { label: 'อนุมัติ',       color: 'bg-green-100 text-green-700' },
    REJECTED:  { label: 'ปฏิเสธ',        color: 'bg-red-100 text-red-600' },
    REVOKED:   { label: 'เพิกถอน',       color: 'bg-orange-100 text-orange-600' },
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-gray-600">จัดการฟาร์ม</h1>

          {/* Search */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="ค้นหาชื่อฟาร์ม..."
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>
            <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition">
              ค้นหา
            </button>
            {search && (
              <button type="button" onClick={() => { setSearch(''); setSearchInput('') }}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition">
                ล้าง
              </button>
            )}
          </form>

          {/* Filter Tabs */}
          <div className="flex gap-2 flex-wrap">
            {statusTabs.map((tab) => {
              const count = statusCounts ? (tab.key === '' ? statusCounts.all : statusCounts[tab.key as keyof typeof statusCounts]) : 0
              const active = statusFilter === tab.key
              return (
                <button key={tab.key} onClick={() => setStatusFilter(tab.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition ${active ? 'bg-green-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-green-400'}`}>
                  {tab.label}
                  <span className={`text-sm px-1.5 py-0.5 rounded-full font-semibold ${active ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Farm List */}
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-gray-100 h-28 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : farms.length === 0 ? (
            <div className="bg-white rounded-xl p-12 text-center text-gray-500 border border-gray-100">
              ไม่พบฟาร์ม
            </div>
          ) : (
            <div className="space-y-3">
              {farms.map((farm) => (
                <div key={farm.id} className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link href={`/farms/${farm.slug ?? farm.id}`} target="_blank"
                          className="font-bold text-gray-900 hover:text-green-600 transition flex items-center gap-1 group">
                          {farm.name}
                          <ExternalLink size={13} className="text-gray-500 group-hover:text-green-600" />
                        </Link>
                        {farm.isVerified ? (
                          <span className="flex items-center gap-1 text-sm bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                            <CheckCircle size={11} /> อนุมัติแล้ว
                          </span>
                        ) : farm.isSuspended ? (
                          <span className="flex items-center gap-1 text-sm bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-medium">
                            <XCircle size={11} /> ระงับ
                          </span>
                        ) : farm.rejectReason ? (
                          <span className="flex items-center gap-1 text-sm bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">
                            <XCircle size={11} /> ถูกปฏิเสธ
                          </span>
                        ) : (
                          <span className="text-sm bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
                            รอยืนยัน
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-gray-600 mt-0.5">{farm.location}, {farm.province}</p>
                      <p className="text-sm text-gray-500 mt-0.5">
                        เจ้าของ: <span className="font-medium text-gray-700">{farm.user?.name}</span>
                        {farm.user?.email && <span className="ml-1 text-gray-500">({farm.user.email})</span>}
                      </p>

                      {/* Stats row */}
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <span className="flex items-center gap-1 text-sm text-gray-600">
                          <Package size={12} className="text-gray-500" />
                          {farm._count?.products ?? 0} สินค้า
                        </span>
                        <span className="flex items-center gap-1 text-sm text-gray-600">
                          <ShoppingBag size={12} className="text-blue-400" />
                          {farm.orderCount.toLocaleString()} ออเดอร์
                        </span>
                        <span className="flex items-center gap-1 text-sm font-medium text-green-700">
                          <TrendingUp size={12} className="text-green-500" />
                          ฿{farm.revenue.toLocaleString()}
                        </span>
                        <span className="flex items-center gap-1 text-sm text-gray-600">
                          <Heart size={12} className="text-red-400" />
                          {farm._count?.farmLikes ?? 0} ถูกใจ
                        </span>
                        <span className="flex items-center gap-1 text-sm text-gray-600">
                          <Star size={12} className="text-yellow-400 fill-yellow-400" />
                          {farm._count?.farmReviews ?? 0} รีวิว
                        </span>
                        <span className="text-sm text-gray-500">
                          สมัคร {new Date(farm.createdAt).toLocaleDateString('th-TH', { dateStyle: 'medium' })}
                        </span>
                      </div>

                      {farm.rejectReason && (
                        <p className="text-sm text-red-500 mt-1.5 bg-red-50 px-3 py-1.5 rounded-lg">
                          เหตุผล: {farm.rejectReason}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      <button onClick={() => setLogFarmId(farm.id)}
                        className="flex items-center gap-1 bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-200 transition">
                        <History size={14} /> ประวัติ
                      </button>
                      {/* รอยืนยัน (pending): !isVerified && !isSuspended && !rejectReason */}
                      {!farm.isVerified && !farm.isSuspended && !farm.rejectReason && (
                        <button onClick={() => verifyFarm.mutate({ id: farm.id, isVerified: true })}
                          disabled={verifyFarm.isPending}
                          className="flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1.5 rounded-lg text-sm hover:bg-green-200 transition disabled:opacity-50">
                          <CheckCircle size={14} /> อนุมัติ
                        </button>
                      )}
                      {!farm.isVerified && !farm.isSuspended && !farm.rejectReason && (
                        <button onClick={() => handleReject(farm.id)}
                          disabled={verifyFarm.isPending}
                          className="flex items-center gap-1 bg-red-100 text-red-600 px-3 py-1.5 rounded-lg text-sm hover:bg-red-200 transition disabled:opacity-50">
                          <XCircle size={14} /> ปฏิเสธ
                        </button>
                      )}
                      {/* อนุมัติแล้ว: isVerified */}
                      {farm.isVerified && (
                        <button onClick={() => { setRevokeTarget(farm.id); setRevokeReason('') }}
                          disabled={verifyFarm.isPending}
                          className="flex items-center gap-1 bg-orange-100 text-orange-600 px-3 py-1.5 rounded-lg text-sm hover:bg-orange-200 transition disabled:opacity-50">
                          <XCircle size={14} /> เพิกถอน
                        </button>
                      )}
                      {/* ถูกปฏิเสธ / ระงับ: รอ seller resubmit ก่อน → ไม่แสดงปุ่ม action */}
                    </div>
                  </div>

                  {/* Reject reason input */}
                  {rejectingId === farm.id && (
                    <div className="flex gap-2 pt-1 border-t border-gray-100">
                      <input
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="ระบุเหตุผลที่ปฏิเสธ..."
                        className="flex-1 border border-red-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                      />
                      <button onClick={() => handleReject(farm.id)}
                        disabled={verifyFarm.isPending}
                        className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-600 transition disabled:opacity-50">
                        ยืนยัน
                      </button>
                      <button onClick={() => setRejectingId(null)} className="btn-cancel">
                        ยกเลิก
                      </button>
                    </div>
                  )}
                </div>
              ))}

              <div ref={sentinelRef} className="h-4" />
              {isFetchingNextPage && (
                <div className="flex justify-center py-4 text-gray-500">
                  <Loader2 size={20} className="animate-spin" />
                </div>
              )}
              {!hasNextPage && farms.length > PAGE_SIZE && (
                <p className="text-center text-sm text-gray-500 py-3">แสดงทั้งหมด {farms.length} ฟาร์ม</p>
              )}
            </div>
          )}

          {/* Approval Log Modal */}
          {logFarmId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/40" onClick={() => setLogFarmId(null)} />
              <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
                <div className="flex items-center justify-between p-5 border-b border-gray-100">
                  <h2 className="text-base font-bold text-gray-600">ประวัติการอนุมัติฟาร์ม</h2>
                  <button onClick={() => setLogFarmId(null)} className="text-gray-500 hover:text-gray-700 transition">
                    <X size={20} />
                  </button>
                </div>
                <div className="overflow-y-auto p-5 space-y-3 flex-1">
                  {logsLoading ? (
                    <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-gray-500" /></div>
                  ) : !approvalLogs?.length ? (
                    <p className="text-center text-gray-500 py-8 text-sm">ยังไม่มีประวัติ</p>
                  ) : (
                    approvalLogs.map((log: { id: string; action: string; note?: string; createdAt: string; actor?: { name: string; role: string } }) => {
                      const a = actionLabel[log.action] ?? { label: log.action, color: 'bg-gray-100 text-gray-700' }
                      return (
                        <div key={log.id} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className="w-2 h-2 rounded-full bg-gray-300 mt-1.5 flex-shrink-0" />
                            <div className="w-px flex-1 bg-gray-100 mt-1" />
                          </div>
                          <div className="pb-3 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-sm px-2 py-0.5 rounded-full font-medium ${a.color}`}>{a.label}</span>
                              <span className="text-sm text-gray-500">
                                {new Date(log.createdAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}
                              </span>
                            </div>
                            {log.actor && (
                              <p className="text-sm text-gray-600 mt-0.5">
                                โดย <span className="font-medium">{log.actor.name}</span>
                                <span className="ml-1 text-gray-500">({log.actor.role})</span>
                              </p>
                            )}
                            {log.note && (
                              <p className="text-sm text-gray-700 mt-1 bg-gray-50 rounded-lg px-3 py-2">{log.note}</p>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          <ConfirmDialog
            open={!!revokeTarget}
            title="ยืนยันการเพิกถอน"
            description="ฟาร์มนี้จะถูกระงับการใช้งาน เจ้าของฟาร์มจะเห็นข้อความด้านล่างและต้องยื่นขออนุมัติใหม่"
            confirmLabel="เพิกถอน"
            cancelLabel="ยกเลิก"
            variant="warning"
            isLoading={verifyFarm.isPending}
            onConfirm={() => {
              if (revokeTarget) verifyFarm.mutate(
                { id: revokeTarget, isVerified: false, reason: revokeReason.trim() || undefined },
                { onSettled: () => { setRevokeTarget(null); setRevokeReason('') } }
              )
            }}
            onCancel={() => { setRevokeTarget(null); setRevokeReason('') }}
          >
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-600">เหตุผลที่ระงับ (จะแสดงต่อเจ้าของฟาร์ม)</label>
              <textarea
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="เช่น ตรวจพบข้อมูลไม่ถูกต้อง กรุณาแก้ไขและยื่นใหม่..."
                rows={3}
                className="w-full border border-orange-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
              />
            </div>
          </ConfirmDialog>
    </div>
  )
}
