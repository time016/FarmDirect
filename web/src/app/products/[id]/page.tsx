'use client'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'
import api from '@/lib/api'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'
import { useAuthModalStore } from '@/store/authModalStore'
import { Star, MapPin, ShoppingCart, Plus, Minus, Expand, ChevronLeft, ChevronRight, Play, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'
import ImageViewer from '@/components/ImageViewer'
import ProductCard from '@/components/ProductCard'

type MediaItem = { type: 'image'; url: string } | { type: 'video'; url: string; embed: string | null }

function getVideoEmbed(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/)
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`
  if (url.includes('facebook.com')) return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&width=640&show_text=false`
  return null
}

function getVideoThumb(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/)
  if (yt) return `https://img.youtube.com/vi/${yt[1]}/mqdefault.jpg`
  return null
}

export default function ProductDetailPage() {
  const { id } = useParams()
  const [qty, setQty] = useState(1)
  const [slideIndex, setSlideIndex] = useState(0)
  const [viewerOpen, setViewerOpen] = useState(false)
  const { addToCart } = useCartStore()
  const { isAuthenticated, user } = useAuthStore()
  const { openLogin } = useAuthModalStore()

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => api.get(`/products/${id}`).then((r) => r.data),
  })

  const mediaItems: MediaItem[] = [
    ...(product?.images ?? []).map((url: string) => ({ type: 'image' as const, url })),
    ...(product?.videos ?? []).map((url: string) => ({ type: 'video' as const, url, embed: getVideoEmbed(url) })),
  ]
  const imgOnlyItems = mediaItems.filter((m) => m.type === 'image')

  const { data: farmProductsData } = useQuery({
    queryKey: ['farm-products', product?.farm?.id],
    queryFn: () => api.get(`/products?farmId=${product.farm.id}&limit=12`).then((r) => r.data),
    enabled: !!product?.farm?.id,
  })

  const otherProducts = farmProductsData?.products?.filter((p: { id: string }) => p.id !== id) ?? []

  const { data: myFarm } = useQuery({
    queryKey: ['my-farm'],
    queryFn: () => api.get('/farms/my').then((r) => r.data),
    enabled: isAuthenticated && (user?.role === 'SELLER' || user?.role === 'ADMIN'),
  })

  const handleAddToCart = async () => {
    if (!isAuthenticated) { openLogin(); return }
    if (user?.role === 'ADMIN') { toast.error('แอดมินไม่สามารถสั่งซื้อได้'); return }
    if (myFarm?.id && product?.farm?.id === myFarm.id) { toast.error('ไม่สามารถสั่งซื้อสินค้าของฟาร์มตัวเองได้'); return }
    try {
      await addToCart(product.id, qty)
      toast.success('เพิ่มสินค้าในตะกร้าแล้ว')
    } catch {
      toast.error('เกิดข้อผิดพลาด')
    }
  }

  if (isLoading) return <div className="animate-pulse bg-gray-100 h-96 rounded-2xl" />
  if (!product) return <div className="text-center py-20 text-gray-500">ไม่พบสินค้า</div>

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Media Slideshow */}
        <div>
          <div className="relative h-80 bg-gray-100 rounded-2xl overflow-hidden mb-3 group">
            {mediaItems.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-7xl">🌿</div>
            ) : mediaItems[slideIndex]?.type === 'image' ? (
              <>
                <img
                  src={mediaItems[slideIndex].url}
                  alt={product.name}
                  className="w-full h-full object-cover cursor-zoom-in"
                  onClick={() => setViewerOpen(true)}
                />
                <button onClick={() => setViewerOpen(true)}
                  className="absolute top-3 right-3 bg-black/40 hover:bg-black/60 text-white rounded-lg p-2 opacity-0 group-hover:opacity-100 transition">
                  <Expand size={16} />
                </button>
              </>
            ) : mediaItems[slideIndex]?.type === 'video' ? (
              (mediaItems[slideIndex] as MediaItem & { type: 'video' }).embed ? (
                <iframe
                  src={(mediaItems[slideIndex] as MediaItem & { type: 'video' }).embed!}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <a href={mediaItems[slideIndex].url} target="_blank" rel="noopener noreferrer"
                  className="w-full h-full flex flex-col items-center justify-center gap-3 text-gray-600 hover:text-green-600 transition">
                  <Play size={48} />
                  <span className="text-sm">เปิดวิดีโอ</span>
                </a>
              )
            ) : null}

            {mediaItems.length > 1 && (
              <>
                <button onClick={() => setSlideIndex((slideIndex - 1 + mediaItems.length) % mediaItems.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full w-8 h-8 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                  <ChevronLeft size={18} />
                </button>
                <button onClick={() => setSlideIndex((slideIndex + 1) % mediaItems.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full w-8 h-8 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                  <ChevronRight size={18} />
                </button>
              </>
            )}
          </div>

          {/* Thumbnail strip */}
          {mediaItems.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              {mediaItems.map((item, i) => (
                <button key={i} onClick={() => setSlideIndex(i)}
                  className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition flex-shrink-0 bg-gray-100 ${i === slideIndex ? 'border-green-500' : 'border-transparent hover:border-gray-300'}`}>
                  {item.type === 'image' ? (
                    <img src={item.url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full relative">
                      {getVideoThumb(item.url) ? (
                        <img src={getVideoThumb(item.url)!} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                          <Play size={20} className="text-gray-600" />
                        </div>
                      )}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <Play size={16} className="text-white" fill="white" />
                      </div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="space-y-4">
          <div>
            <p className="text-sm text-green-600">{product.category?.name}</p>
            <h1 className="text-2xl font-bold text-gray-600">{product.name}</h1>
          </div>

          <Link href={`/farms/${product.farm?.slug ?? product.farm?.id}`} className="flex items-center gap-2 text-gray-600 hover:text-green-600 text-sm">
            <MapPin size={14} /> {product.farm?.name} · {product.farm?.province}
          </Link>

          <div className="flex items-center gap-2 text-yellow-500 text-sm">
            {[1, 2, 3, 4, 5].map((s) => <Star key={s} size={14} fill={s <= Math.round(product.reviews?.reduce((a: number, r: { rating: number }) => a + r.rating, 0) / (product.reviews?.length || 1) || 0) ? 'currentColor' : 'none'} />)}
            <span className="text-gray-600">({product.reviews?.length ?? 0} รีวิว)</span>
          </div>

          <div className="text-3xl font-bold text-green-700">
            ฿{Number(product.displayPrice ?? product.price).toLocaleString()}
            <span className="text-base font-normal text-gray-500">/{product.unit}</span>
          </div>

          <p className="text-gray-700">{product.description}</p>
          <p className="text-sm text-gray-600">คงเหลือ: <span className="font-medium text-gray-800">{product.stock - (product.reservedStock ?? 0)} {product.unit}</span></p>

          {/* Qty + Cart */}
          <div className="flex items-center gap-4">
            {(() => { const avail = product.stock - (product.reservedStock ?? 0); return (<>
            <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
              <button onClick={() => setQty(Math.max(1, qty - 1))} className="px-3 py-2 hover:bg-gray-100 transition"><Minus size={14} /></button>
              <span className="px-4 py-2 font-medium">{qty}</span>
              <button onClick={() => setQty(Math.min(avail, qty + 1))} className="px-3 py-2 hover:bg-gray-100 transition"><Plus size={14} /></button>
            </div>
            <button
              onClick={handleAddToCart}
              disabled={avail <= 0}
              className="flex items-center gap-2 bg-green-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-40"
            >
              <ShoppingCart size={18} /> ใส่ตะกร้า
            </button>
            </>)})()}
          </div>
        </div>
      </div>

      {/* Reviews */}
      {product.reviews?.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-gray-600 mb-4">รีวิวสินค้า</h2>
          <div className="space-y-3">
            {product.reviews.map((r: { id: string; user?: { name: string; avatar?: string }; rating: number; comment?: string; quantity?: number; createdAt: string }) => (
              <div key={r.id} className="bg-white rounded-xl p-4 border border-gray-100">
                <div className="flex items-center gap-3 mb-2">
                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {r.user?.avatar
                      ? <img src={r.user.avatar} alt={r.user.name} className="w-full h-full object-cover" />
                      : <span className="text-green-700 text-sm font-bold">{r.user?.name?.[0]?.toUpperCase()}</span>
                    }
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm text-gray-800">{r.user?.name}</p>
                      {r.quantity != null && (
                        <span className="flex items-center gap-1 text-sm bg-green-50 text-green-700 border border-green-200 rounded-full px-2 py-0.5 font-medium">
                          ✓ ซื้อแล้ว {r.quantity} {product.unit}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-yellow-400 mt-0.5">
                      {[1, 2, 3, 4, 5].map((s) => <Star key={s} size={11} fill={s <= r.rating ? 'currentColor' : 'none'} />)}
                      <span className="text-sm text-gray-500 ml-1">{new Date(r.createdAt).toLocaleDateString('th-TH')}</span>
                    </div>
                  </div>
                </div>
                {r.comment && <p className="text-gray-700 text-sm ml-11">{r.comment}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* More from this farm */}
      {otherProducts.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-600">สินค้าอื่นๆ จาก {product.farm?.name}</h2>
            <Link href={`/farms/${product.farm?.slug ?? product.farm?.id}#products`} className="text-green-600 text-sm flex items-center gap-1 hover:underline">
              ดูทั้งหมด <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {otherProducts.slice(0, 12).map((p: any) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}

      {viewerOpen && imgOnlyItems.length > 0 && (
        <ImageViewer
          images={imgOnlyItems.map((m) => m.url)}
          initialIndex={imgOnlyItems.findIndex((m) => m.url === mediaItems[slideIndex]?.url)}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </div>
  )
}
