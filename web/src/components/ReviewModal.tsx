'use client'
import { useState } from 'react'
import { Star, X } from 'lucide-react'

interface ReviewItem {
  productId: string
  productName: string
  productImage?: string
}

interface ReviewData {
  productId: string
  rating: number
  comment: string
}

interface Props {
  open: boolean
  items: ReviewItem[]
  isLoading?: boolean
  onConfirm: (reviews: ReviewData[]) => void
  onCancel: () => void
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          onMouseEnter={() => setHover(s)}
          onMouseLeave={() => setHover(0)}
          className="transition"
        >
          <Star
            size={28}
            className={(hover || value) >= s ? 'text-yellow-400' : 'text-gray-300'}
            fill={(hover || value) >= s ? 'currentColor' : 'none'}
          />
        </button>
      ))}
    </div>
  )
}

const ratingLabel = ['', 'แย่มาก', 'พอใช้', 'ปานกลาง', 'ดี', 'ดีมาก']

export default function ReviewModal({ open, items, isLoading = false, onConfirm, onCancel }: Props) {
  const [reviews, setReviews] = useState<Record<string, { rating: number; comment: string }>>(
    () => Object.fromEntries(items.map((i) => [i.productId, { rating: 5, comment: '' }]))
  )

  if (!open) return null

  const setReview = (productId: string, field: 'rating' | 'comment', value: number | string) => {
    setReviews((prev) => ({ ...prev, [productId]: { ...prev[productId], [field]: value } }))
  }

  const handleSubmit = () => {
    const data = items.map((item) => ({
      productId: item.productId,
      rating: reviews[item.productId]?.rating ?? 5,
      comment: reviews[item.productId]?.comment ?? '',
    }))
    onConfirm(data)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-800">ยืนยันได้รับสินค้าแล้ว และเขียนรีวิว</h2>
            <p className="text-sm text-gray-500 mt-0.5">กรุณาให้คะแนนสินค้าที่ได้รับ</p>
          </div>
          <button onClick={onCancel} className="text-gray-500 hover:text-gray-700 transition">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-6">
          {items.map((item) => {
            const r = reviews[item.productId] ?? { rating: 5, comment: '' }
            return (
              <div key={item.productId} className="space-y-3">
                {/* Product info */}
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                    {item.productImage
                      ? <img src={item.productImage} alt={item.productName} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-xl">🌿</div>
                    }
                  </div>
                  <p className="font-medium text-gray-800 text-sm">{item.productName}</p>
                </div>

                {/* Stars */}
                <div className="flex items-center gap-3">
                  <StarRating value={r.rating} onChange={(v) => setReview(item.productId, 'rating', v)} />
                  {r.rating > 0 && <span className="text-sm text-yellow-500 font-medium">{ratingLabel[r.rating]}</span>}
                </div>

                {/* Comment */}
                <textarea
                  value={r.comment}
                  onChange={(e) => setReview(item.productId, 'comment', e.target.value)}
                  placeholder="แบ่งปันความคิดเห็นของคุณ..."
                  rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                />

                {items.indexOf(item) < items.length - 1 && <hr className="border-gray-100" />}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
          <button onClick={onCancel} disabled={isLoading}
            className="px-4 py-2 rounded-lg text-sm border border-gray-300 text-gray-700 hover:bg-gray-50 transition disabled:opacity-50">
            ยกเลิก
          </button>
          <button onClick={handleSubmit} disabled={isLoading}
            className="px-5 py-2 rounded-lg text-sm font-semibold bg-green-600 hover:bg-green-700 text-white transition disabled:opacity-50">
            {isLoading ? 'กำลังบันทึก...' : 'ยืนยันได้รับสินค้าแล้ว'}
          </button>
        </div>
      </div>
    </div>
  )
}
