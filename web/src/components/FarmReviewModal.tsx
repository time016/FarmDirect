'use client'
import { useState } from 'react'
import { Star, X } from 'lucide-react'

interface Props {
  farmName: string
  onConfirm: (rating: number, comment: string) => void
  onSkip: () => void
  isLoading?: boolean
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          className="transition-transform hover:scale-110"
        >
          <Star
            size={32}
            className={`transition-colors ${star <= (hover || value) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
          />
        </button>
      ))}
    </div>
  )
}

const ratingLabel = ['', 'ไม่ดีเลย', 'พอใช้ได้', 'โอเค', 'ดีมาก', 'ยอดเยี่ยม!']

export default function FarmReviewModal({ farmName, onConfirm, onSkip, isLoading }: Props) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-gray-800 text-lg">รีวิวฟาร์ม</h2>
          <button onClick={onSkip} className="text-gray-500 hover:text-gray-700 transition"><X size={20} /></button>
        </div>

        <div className="text-center space-y-1">
          <p className="text-2xl">🏡</p>
          <p className="text-sm text-gray-600">คุณพอใจกับฟาร์ม</p>
          <p className="font-semibold text-gray-800">{farmName}</p>
          <p className="text-sm text-gray-600">มากแค่ไหน?</p>
        </div>

        <div className="flex flex-col items-center gap-2">
          <StarRating value={rating} onChange={setRating} />
          {rating > 0 && (
            <p className="text-sm font-medium text-yellow-600 animate-in fade-in">
              {ratingLabel[rating]}
            </p>
          )}
        </div>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="แสดงความคิดเห็นเกี่ยวกับฟาร์มนี้ (ไม่บังคับ)"
          rows={3}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
        />

        <div className="flex gap-3">
          <button
            onClick={onSkip}
            className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2.5 text-sm hover:bg-gray-50 transition"
          >
            ข้ามขั้นตอนนี้
          </button>
          <button
            onClick={() => onConfirm(rating, comment)}
            disabled={rating === 0 || isLoading}
            className="flex-1 bg-green-600 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-green-700 transition disabled:opacity-50"
          >
            {isLoading ? 'กำลังส่ง...' : 'ส่งรีวิว'}
          </button>
        </div>
      </div>
    </div>
  )
}
