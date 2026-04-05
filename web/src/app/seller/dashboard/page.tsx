'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'
import { OrderStatus } from '@/types'
import { Package, ShoppingBag, Store, Eye, TrendingUp, AlertTriangle, RefreshCw, ArrowUp, ArrowDown } from 'lucide-react'
import toast from 'react-hot-toast'


interface DayView { date: string; count: number }
interface ProductStat { id: string; name: string; views?: number; quantity?: number }
interface Analytics {
  views14days: DayView[]
  topViewedProducts: ProductStat[]
  topSellingProducts: ProductStat[]
}

function ViewsChart({ data }: { data: DayView[] }) {
  const max = Math.max(...data.map((d) => d.count), 1)
  return (
    <div className="flex items-end gap-1 h-24 w-full">
      {data.map((d) => {
        const heightPct = Math.max((d.count / max) * 100, 2)
        const date = new Date(d.date)
        const label = `${date.getMonth() + 1}/${date.getDate()}`
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group relative">
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-sm px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap z-10">
              {d.count} ครั้ง
            </div>
            <div
              className="w-full bg-green-500 rounded-t-sm hover:bg-green-400 transition"
              style={{ height: `${heightPct}%` }}
            />
            {data.length <= 14 && (
              <span className="text-[9px] text-gray-500 leading-none">{label}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function SellerDashboardPage() {
  const { user, isAuthenticated } = useAuthStore()
  const router = useRouter()
  const qc = useQueryClient()
  const isSellerOrAdmin = user?.role === 'SELLER' || (user?.role === 'ADMIN' || user?.role === 'HOST')
  const [resubmitMessage, setResubmitMessage] = useState('')
  const [showResubmitForm, setShowResubmitForm] = useState(false)
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year'>('week')

  useEffect(() => {
    if (!isAuthenticated) router.push('/')
  }, [isAuthenticated, user])

  const { data: farm } = useQuery({
    queryKey: ['my-farm'],
    queryFn: () => api.get('/farms/my').then((r) => r.data),
    enabled: isAuthenticated,
  })


  const { data: ordersData } = useQuery({
    queryKey: ['seller-orders'],
    queryFn: () => api.get('/orders/seller').then((r) => r.data),
    enabled: isAuthenticated,
  })

  const { data: analytics } = useQuery<Analytics>({
    queryKey: ['farm-analytics'],
    queryFn: () => api.get('/farms/analytics').then((r) => r.data),
    enabled: isAuthenticated,
  })

  const { data: summary } = useQuery({
    queryKey: ['farm-summary', period],
    queryFn: () => api.get('/farms/summary', { params: { period } }).then((r) => r.data),
    enabled: isAuthenticated && !!farm,
  })

  const totalViews = analytics?.views14days.reduce((s, d) => s + d.count, 0) ?? 0

  const resubmit = useMutation({
    mutationFn: (message: string) => api.post('/farms/resubmit', { message }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-farm'] })
      setShowResubmitForm(false)
      setResubmitMessage('')
      toast.success('ยื่นขออนุมัติใหม่แล้ว กรุณารอการตรวจสอบ')
    },
    onError: () => toast.error('เกิดข้อผิดพลาด'),
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-600">แดชบอร์ดผู้ขาย</h1>

      {/* No farm warning */}
      {!farm && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
          <p className="text-yellow-700 mb-3">คุณยังไม่มีฟาร์ม กรุณาสร้างฟาร์มก่อน</p>
          <Link href="/seller/farm/create" className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition">
            สร้างฟาร์ม
          </Link>
        </div>
      )}

      {/* Farm suspended / rejected banner */}
      {farm && !farm.isVerified && farm.rejectReason && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-red-700">ฟาร์มของคุณถูกระงับการใช้งาน</p>
              <p className="text-sm text-red-600 mt-1">
                <span className="font-medium">เหตุผลจาก Admin:</span> {farm.rejectReason}
              </p>
            </div>
          </div>
          {!showResubmitForm ? (
            <button
              onClick={() => setShowResubmitForm(true)}
              className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition"
            >
              <RefreshCw size={14} /> ยื่นขออนุมัติใหม่
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium text-red-700">ข้อความถึง Admin (ระบุสิ่งที่แก้ไขแล้ว)</p>
              <textarea
                value={resubmitMessage}
                onChange={(e) => setResubmitMessage(e.target.value)}
                placeholder="เช่น ได้แก้ไขข้อมูลฟาร์มและเพิ่มรายละเอียดเรียบร้อยแล้ว..."
                rows={3}
                className="w-full border border-red-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => resubmit.mutate(resubmitMessage)}
                  disabled={resubmit.isPending}
                  className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition disabled:opacity-50"
                >
                  <RefreshCw size={14} /> {resubmit.isPending ? 'กำลังส่ง...' : 'ยืนยันยื่นขออนุมัติ'}
                </button>
                <button
                  onClick={() => { setShowResubmitForm(false); setResubmitMessage('') }}
                  className="btn-cancel"
                >
                  ยกเลิก
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Farm pending verification (ยังไม่เคย verify และยังไม่ถูก reject) */}
      {farm && !farm.isVerified && !farm.rejectReason && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle size={18} className="text-yellow-500 flex-shrink-0" />
          <p className="text-sm text-yellow-700">ฟาร์มของคุณอยู่ระหว่างรอการตรวจสอบจาก Admin</p>
        </div>
      )}

      {/* Summary Stats */}
      {farm && (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-gray-700">ภาพรวมยอดขาย</p>
            <div className="flex gap-1">
              {(['day', 'week', 'month', 'year'] as const).map((p) => {
                const label = { day: 'วันนี้', week: 'สัปดาห์', month: 'เดือน', year: 'ปี' }[p]
                return (
                  <button key={p} onClick={() => setPeriod(p)}
                    className={`px-2.5 py-1 rounded-lg text-sm font-medium transition ${period === p ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <ShoppingBag size={15} className="text-blue-500" />
                <span className="text-sm font-medium text-blue-600">คำสั่งซื้อ</span>
              </div>
              <p className="text-2xl font-extrabold text-gray-900">{(summary?.totalOrders ?? 0).toLocaleString()}</p>
              {summary?.orderGrowth != null && (
                <p className={`text-sm mt-1 flex items-center gap-0.5 ${summary.orderGrowth >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {summary.orderGrowth >= 0 ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
                  {Math.abs(summary.orderGrowth)}% จากช่วงก่อน
                </p>
              )}
            </div>
            <div className="bg-green-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={15} className="text-green-500" />
                <span className="text-sm font-medium text-green-600">ยอดขายรวม</span>
              </div>
              <p className="text-2xl font-extrabold text-gray-900">฿{(summary?.totalRevenue ?? 0).toLocaleString()}</p>
              {summary?.revenueGrowth != null && (
                <p className={`text-sm mt-1 flex items-center gap-0.5 ${summary.revenueGrowth >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {summary.revenueGrowth >= 0 ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
                  {Math.abs(summary.revenueGrowth)}% จากช่วงก่อน
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-5 border border-gray-100 text-center">
          <Package size={24} className="mx-auto text-green-600 mb-2" />
          <p className="text-2xl font-bold text-gray-600">{farm?.products?.length ?? 0}</p>
          <p className="text-sm text-gray-600">สินค้าทั้งหมด</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100 text-center">
          <ShoppingBag size={24} className="mx-auto text-green-600 mb-2" />
          <p className="text-2xl font-bold text-gray-600">{ordersData?.total ?? 0}</p>
          <p className="text-sm text-gray-600">คำสั่งซื้อทั้งหมด</p>
        </div>
      </div>


      {/* 14-day Views Chart */}
      {analytics && (
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-base font-bold text-gray-600">ยอดเข้าชมฟาร์ม</h2>
              <p className="text-sm text-gray-500 mt-0.5">14 วันที่ผ่านมา</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-green-600">{totalViews.toLocaleString()}</p>
              <p className="text-sm text-gray-500">ครั้งทั้งหมด</p>
            </div>
          </div>
          <ViewsChart data={analytics.views14days} />
        </div>
      )}

      {/* Top Products */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Most Viewed */}
          <div className="bg-white rounded-xl p-5 border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <Eye size={16} className="text-blue-500" />
              <h2 className="text-base font-bold text-gray-600">สินค้าเข้าชมสูงสุด</h2>
            </div>
            {analytics.topViewedProducts.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">ยังไม่มีข้อมูล</p>
            ) : (
              <div className="space-y-3">
                {analytics.topViewedProducts.map((p, i) => {
                  const maxViews = analytics.topViewedProducts[0].views ?? 1
                  return (
                    <div key={p.id}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm text-gray-700 truncate flex-1 mr-2">
                          <span className="text-gray-500 mr-1">{i + 1}.</span>{p.name}
                        </span>
                        <span className="text-sm font-semibold text-blue-600 whitespace-nowrap">{p.views} ครั้ง</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className="bg-blue-400 h-1.5 rounded-full" style={{ width: `${((p.views ?? 0) / maxViews) * 100}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Best Selling */}
          <div className="bg-white rounded-xl p-5 border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={16} className="text-green-500" />
              <h2 className="text-base font-bold text-gray-600">สินค้าขายดีสุด</h2>
            </div>
            {analytics.topSellingProducts.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">ยังไม่มีข้อมูล</p>
            ) : (
              <div className="space-y-3">
                {analytics.topSellingProducts.map((p, i) => {
                  const maxQty = analytics.topSellingProducts[0].quantity ?? 1
                  return (
                    <div key={p.id}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm text-gray-700 truncate flex-1 mr-2">
                          <span className="text-gray-500 mr-1">{i + 1}.</span>{p.name}
                        </span>
                        <span className="text-sm font-semibold text-green-600 whitespace-nowrap">{p.quantity} ชิ้น</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className="bg-green-400 h-1.5 rounded-full" style={{ width: `${((p.quantity ?? 0) / maxQty) * 100}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  )
}
