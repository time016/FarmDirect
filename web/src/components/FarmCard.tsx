import Link from 'next/link'
import { MapPin, Package, CheckCircle, Heart, Star } from 'lucide-react'
import { Farm } from '@/types'

function avgRating(reviews?: { rating: number }[]) {
  if (!reviews?.length) return 0
  return reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
}

export default function FarmCard({ farm }: { farm: Farm }) {
  const avg = avgRating(farm.farmReviews)
  const reviewCount = farm.farmReviews?.length ?? 0
  const likeCount = farm._count?.farmLikes ?? 0

  return (
    <Link href={`/farms/${farm.slug ?? farm.id}`}>
      <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition overflow-hidden border border-gray-100">
        <div className="relative h-40 bg-gray-100">
          {farm.image ? (
            <img src={farm.image} alt={farm.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-5xl">🏡</div>
          )}
          {farm.isVerified && (
            <div className="absolute top-2 right-2 bg-green-500 text-white text-sm px-2 py-0.5 rounded-full flex items-center gap-1">
              <CheckCircle size={10} /> ยืนยันแล้ว
            </div>
          )}
        </div>
        <div className="p-4">
          <h3 className="font-semibold text-gray-600">{farm.name}</h3>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-sm text-gray-600 flex items-center gap-1">
              <MapPin size={12} /> {farm.province}
            </p>
            <span className="text-sm text-gray-500 flex items-center gap-1">
              <Package size={11} /> {farm._count?.products ?? 0} สินค้า
            </span>
          </div>

          {/* Stars + like */}
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1">
              {[1,2,3,4,5].map((s) => (
                <Star key={s} size={11} className={s <= Math.round(avg) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'} />
              ))}
              <span className="text-sm text-gray-500 ml-0.5">
                {reviewCount > 0 ? `(${reviewCount})` : ''}
              </span>
            </div>
            <span className="flex items-center gap-1 text-sm text-gray-500">
              <Heart size={11} className="text-red-400 fill-red-400" /> {likeCount}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
