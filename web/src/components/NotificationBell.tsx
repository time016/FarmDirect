'use client'
import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, X, CheckCheck, ExternalLink } from 'lucide-react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { useAuthStore } from '@/store/authStore'

interface Notification {
  id: string
  type: string
  title: string
  body: string
  link?: string | null
  isRead: boolean
  createdAt: string
}

const TYPE_ICON: Record<string, string> = {
  ORDER_PLACED:        '🛒',
  ORDER_PAID:          '💳',
  ORDER_CONFIRMED:     '✅',
  ORDER_SHIPPING:      '🚚',
  ORDER_DELIVERED:     '📦',
  ORDER_CANCELLED:     '❌',
  FARM_SUBMITTED:      '🏡',
  FARM_APPROVED:       '✅',
  FARM_REJECTED:       '⚠️',
  FARM_REVOKED:        '🚫',
  FARM_REVIEW:         '⭐',
  FARM_ADMIN_ACCEPTED: '👤',
  FARM_ADMIN_DECLINED: '👤',
}

function timeAgo(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return 'เมื่อกี้'
  if (diff < 3600) return `${Math.floor(diff / 60)} นาทีที่แล้ว`
  if (diff < 86400) return `${Math.floor(diff / 3600)} ชั่วโมงที่แล้ว`
  return `${Math.floor(diff / 86400)} วันที่แล้ว`
}

export default function NotificationBell({ onOpen }: { onOpen?: () => void } = {}) {
  const { isAuthenticated } = useAuthStore()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const qc = useQueryClient()

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications?limit=20').then((r) => r.data),
    enabled: isAuthenticated,
    refetchInterval: 60000,
  })

  const unreadCount: number = data?.unreadCount ?? 0
  const notifications: Notification[] = data?.notifications ?? []

  const markRead = useMutation({
    mutationFn: (id: string) => api.put(`/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const markAllRead = useMutation({
    mutationFn: () => api.put('/notifications/read-all'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const deleteNotif = useMutation({
    mutationFn: (id: string) => api.delete(`/notifications/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const deleteAll = useMutation({
    mutationFn: () => api.delete('/notifications/all'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (!isAuthenticated) return null

  const handleClick = (n: Notification) => {
    if (!n.isRead) markRead.mutate(n.id)
    if (n.link) { router.push(n.link); setOpen(false) }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen((o) => { if (!o) onOpen?.(); return !o }) }}
        className="relative hover:text-green-200 transition flex items-center justify-center"
        title="การแจ้งเตือน"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-0.5">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="font-semibold text-gray-700 text-sm">การแจ้งเตือน</span>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllRead.mutate()}
                  className="flex items-center gap-1 text-sm text-green-600 hover:text-green-700"
                >
                  <CheckCheck size={14} /> อ่านทั้งหมด
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={() => deleteAll.mutate()}
                  className="flex items-center gap-1 text-sm text-gray-400 hover:text-red-500 transition"
                >
                  <X size={14} /> ลบทั้งหมด
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-gray-100">
            {notifications.length === 0 ? (
              <div className="py-10 text-center text-gray-500 text-sm">ไม่มีการแจ้งเตือน</div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition ${!n.isRead ? 'bg-green-50' : ''}`}
                >
                  <span className="text-lg flex-shrink-0 mt-0.5">{TYPE_ICON[n.type] ?? '🔔'}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-snug ${!n.isRead ? 'font-semibold text-gray-700' : 'text-gray-700'}`}>
                      {n.title}
                    </p>
                    <p className="text-sm text-gray-600 mt-0.5 leading-snug">{n.body}</p>
                    <p className="text-sm text-gray-500 mt-1">{timeAgo(n.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {n.link && <ExternalLink size={12} className="text-gray-400" />}
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteNotif.mutate(n.id) }}
                      className="text-gray-400 hover:text-red-500 transition p-0.5"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
