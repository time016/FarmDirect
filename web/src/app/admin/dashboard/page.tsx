'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'
import { Users, Store, ShoppingBag, Banknote, TrendingUp, ArrowUp, ArrowDown } from 'lucide-react'

export default function AdminDashboardPage() {
  const { isAuthenticated, user } = useAuthStore()
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year'>('week')

  const { data: stats } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => api.get('/admin/dashboard').then((r) => r.data),
    enabled: isAuthenticated && (user?.role === 'ADMIN' || user?.role === 'HOST'),
  })

  const { data: summary } = useQuery({
    queryKey: ['admin-farms-summary', period],
    queryFn: () => api.get('/admin/farms/summary', { params: { period } }).then((r) => r.data),
    enabled: isAuthenticated && (user?.role === 'ADMIN' || user?.role === 'HOST'),
  })

  const statCards = [
    { label: 'ผู้ใช้ทั้งหมด', value: stats?.totalUsers ?? 0, icon: <Users size={22} className="text-blue-500" />, bg: 'bg-blue-50 dark:bg-blue-900/30' },
    { label: 'ฟาร์มทั้งหมด', value: stats?.totalFarms ?? 0, icon: <Store size={22} className="text-green-500" />, bg: 'bg-green-50 dark:bg-green-900/30' },
    { label: 'คำสั่งซื้อ', value: stats?.totalOrders ?? 0, icon: <ShoppingBag size={22} className="text-orange-500" />, bg: 'bg-orange-50 dark:bg-orange-900/30' },
    { label: 'รายได้รวม', value: `฿${Number(stats?.revenue ?? 0).toLocaleString()}`, icon: <Banknote size={22} className="text-purple-500" />, bg: 'bg-purple-50 dark:bg-purple-900/30' },
  ]

  return (
    <div className="space-y-8">
      {/* Order summary */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">ภาพรวมคำสั่งซื้อ</p>
          <div className="flex gap-1">
            {(['day', 'week', 'month', 'year'] as const).map((p) => {
              const label = { day: 'วันนี้', week: 'สัปดาห์นี้', month: 'เดือนนี้', year: 'ปีนี้' }[p]
              return (
                <button key={p} onClick={() => setPeriod(p)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition ${period === p ? 'bg-green-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
                  {label}
                </button>
              )
            })}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-blue-50 dark:bg-blue-900/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <ShoppingBag size={16} className="text-blue-500" />
              <span className="text-sm font-medium text-blue-600 dark:text-blue-400">คำสั่งซื้อ</span>
            </div>
            <p className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">{(summary?.totalOrders ?? 0).toLocaleString()}</p>
            {summary?.orderGrowth !== null && summary?.orderGrowth !== undefined && (
              <p className={`text-sm mt-1 flex items-center gap-0.5 ${summary.orderGrowth >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {summary.orderGrowth >= 0 ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
                {Math.abs(summary.orderGrowth)}% จากช่วงก่อน
              </p>
            )}
          </div>
          <div className="bg-green-50 dark:bg-green-900/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={16} className="text-green-500" />
              <span className="text-sm font-medium text-green-600 dark:text-green-400">ยอดขายรวม</span>
            </div>
            <p className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">฿{(summary?.totalRevenue ?? 0).toLocaleString()}</p>
            {summary?.revenueGrowth !== null && summary?.revenueGrowth !== undefined && (
              <p className={`text-sm mt-1 flex items-center gap-0.5 ${summary.revenueGrowth >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {summary.revenueGrowth >= 0 ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
                {Math.abs(summary.revenueGrowth)}% จากช่วงก่อน
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <div key={s.label} className={`${s.bg} rounded-xl p-5`}>
            <div className="flex justify-between items-start mb-3">
              {s.icon}
            </div>
            <p className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">{s.value}</p>
            <p className="text-sm text-gray-700 dark:text-gray-300 mt-1 font-medium">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
