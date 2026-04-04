import { ReactNode } from 'react'

interface Props {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning'
  isLoading?: boolean
  onConfirm: () => void
  onCancel: () => void
  children?: ReactNode
}

export default function ConfirmDialog({
  open, title, description, confirmLabel = 'ยืนยัน', cancelLabel = 'ยกเลิก',
  variant = 'danger', isLoading = false, onConfirm, onCancel, children,
}: Props) {
  if (!open) return null

  const confirmCls = variant === 'danger'
    ? 'bg-red-600 hover:bg-red-700 text-white'
    : 'bg-yellow-500 hover:bg-yellow-600 text-white'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />

      {/* Dialog */}
      <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4 animate-in fade-in zoom-in-95 duration-150">
        <h2 className="text-lg font-bold text-gray-800 mb-2">{title}</h2>
        {description && <p className="text-sm text-gray-600 mb-3">{description}</p>}
        {children && <div className="mb-4">{children}</div>}

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg text-sm border border-gray-300 text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50 ${confirmCls}`}
          >
            {isLoading ? 'กำลังดำเนินการ...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
