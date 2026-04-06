'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import api from '@/lib/api'
import ProductCard from '@/components/ProductCard'
import ImageUpload from '@/components/ImageUpload'
import { useAuthStore } from '@/store/authStore'
import { useAuthModalStore } from '@/store/authModalStore'
import { Category, Product } from '@/types'
import { MapPin, CheckCircle, Package, Plus, Edit, X, Save, EyeOff, Eye, AlertCircle, RefreshCw, Heart, Star, ChevronLeft, ChevronRight, Play } from 'lucide-react'
import toast from 'react-hot-toast'

const provinces = ['กรุงเทพมหานคร','เชียงใหม่','เชียงราย','ลำปาง','ลำพูน','แพร่','น่าน','พะเยา','แม่ฮ่องสอน','นครสวรรค์','อุทัยธานี','กำแพงเพชร','ตาก','สุโขทัย','พิษณุโลก','พิจิตร','เพชรบูรณ์','อุตรดิตถ์','ขอนแก่น','อุดรธานี','นครราชสีมา','บุรีรัมย์','สุรินทร์','ศรีสะเกษ','อุบลราชธานี','ชัยภูมิ','หนองคาย','หนองบัวลำภู','เลย','สกลนคร','นครพนม','มุกดาหาร','มหาสารคาม','ร้อยเอ็ด','กาฬสินธุ์','ยโสธร','อำนาจเจริญ','บึงกาฬ','ชลบุรี','ระยอง','จันทบุรี','ตราด','ฉะเชิงเทรา','ปราจีนบุรี','สระแก้ว','นครนายก','สมุทรปราการ','นนทบุรี','ปทุมธานี','พระนครศรีอยุธยา','อ่างทอง','ลพบุรี','สิงห์บุรี','ชัยนาท','สระบุรี','นครปฐม','สมุทรสาคร','สมุทรสงคราม','เพชรบุรี','ประจวบคีรีขันธ์','ราชบุรี','กาญจนบุรี','สุพรรณบุรี','นครศรีธรรมราช','กระบี่','พังงา','ภูเก็ต','สุราษฎร์ธานี','ระนอง','ชุมพร','สงขลา','สตูล','ตรัง','พัทลุง','ปัตตานี','ยะลา','นราธิวาส']
const units = ['กิโลกรัม','กรัม','ชิ้น','กล่อง','มัด','ลิตร','แพ็ค','หวี','ลูก']

export default function FarmDetailPage() {
  const { slug: id } = useParams()
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const router = useRouter()

  // Review form state
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [reviewRating, setReviewRating] = useState(0)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewHover, setReviewHover] = useState(0)
  const [reviewSubmitting, setReviewSubmitting] = useState(false)

  // Edit farm state
  const [editingFarm, setEditingFarm] = useState(false)
  const [farmForm, setFarmForm] = useState({ name: '', description: '', location: '', province: '' })

  // Add product state
  const [addingProduct, setAddingProduct] = useState(false)
  const [productForm, setProductForm] = useState({ name: '', description: '', price: '', unit: 'กิโลกรัม', stock: '', categoryId: '', images: [] as string[] })

  const { data: farm, isLoading } = useQuery({
    queryKey: ['farm', id],
    queryFn: () => api.get(`/farms/${id}`).then((r) => r.data),
  })

  const isOwner = !!user && farm?.userId === user?.id
  const isAuthenticated = !!user
  const { openLogin } = useAuthModalStore()

  const { data: likeStatus, refetch: refetchLike } = useQuery({
    queryKey: ['farm-like', id],
    queryFn: () => api.get(`/farms/${id}/like-status`).then((r) => r.data),
  })

  const { data: farmReviewsData, refetch: refetchReviews } = useQuery({
    queryKey: ['farm-reviews', id],
    queryFn: () => api.get(`/farms/${id}/reviews`).then((r) => r.data),
  })

  const { data: canReviewData } = useQuery({
    queryKey: ['farm-can-review', id],
    queryFn: () => api.get(`/farms/${id}/can-review`).then((r) => r.data),
    enabled: !!user && !isOwner,
  })

  const toggleLike = useMutation({
    mutationFn: () => api.post(`/farms/${id}/like`),
    onSuccess: () => refetchLike(),
    onError: () => toast.error('เกิดข้อผิดพลาด'),
  })

  // Owner gets all products (including hidden) from /farms/my
  const { data: myFarm } = useQuery({
    queryKey: ['my-farm'],
    queryFn: () => api.get('/farms/my').then((r) => r.data),
    enabled: isOwner,
  })

  const farmRef = farm ? { id: farm.id, slug: farm.slug, name: farm.name, province: farm.province } : undefined
  const rawProducts: Product[] = isOwner ? (myFarm?.products ?? []) : (farm?.products ?? [])
  const products: Product[] = rawProducts.map((p) => ({ ...p, farm: p.farm ?? farmRef }))

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then((r) => r.data),
  })

  const updateFarm = useMutation({
    mutationFn: () => api.put('/farms', { ...farm, ...farmForm }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['farm', id] })
      setEditingFarm(false)
      toast.success('อัปเดตข้อมูลฟาร์มแล้ว')
    },
    onError: () => toast.error('เกิดข้อผิดพลาด'),
  })

  const addProduct = useMutation({
    mutationFn: () => api.post('/products', {
      ...productForm,
      price: Number(productForm.price),
      stock: Number(productForm.stock),
      images: productForm.images.filter((img) => img.trim()),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['farm', id] })
      qc.invalidateQueries({ queryKey: ['my-farm'] })
      setAddingProduct(false)
      setProductForm({ name: '', description: '', price: '', unit: 'กิโลกรัม', stock: '', categoryId: '', images: [] })
      toast.success('เพิ่มสินค้าแล้ว')
    },
    onError: () => toast.error('เกิดข้อผิดพลาด'),
  })

  const toggleProduct = useMutation({
    mutationFn: ({ pid, isActive }: { pid: string; isActive: boolean }) => api.put(`/products/${pid}`, { isActive }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['farm', id] })
      qc.invalidateQueries({ queryKey: ['my-farm'] })
      toast.success('อัปเดตแล้ว')
    },
  })

  const [resubmitMessage, setResubmitMessage] = useState('')
  const [showResubmitForm, setShowResubmitForm] = useState(false)
  const [slideIndex, setSlideIndex] = useState(0)

  const slideImages: string[] = (() => {
    const imgs = Array.isArray(farm?.images) && farm.images.length > 0 ? farm.images : []
    if (imgs.length === 0 && farm?.image) return [farm.image]
    return imgs
  })()

  const getVideoEmbed = (url: string): string | null => {
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/)
    if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`
    if (url.includes('facebook.com')) return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&width=640&show_text=false`
    return null
  }
  const farmVideos: string[] = Array.isArray(farm?.videos) ? farm.videos : []

  const resubmit = useMutation({
    mutationFn: (message: string) => api.post('/farms/resubmit', { message }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['farm', id] })
      qc.invalidateQueries({ queryKey: ['my-farm'] })
      setShowResubmitForm(false)
      setResubmitMessage('')
      toast.success('ยื่นขออนุมัติใหม่แล้ว กรุณารอการตรวจสอบ')
    },
    onError: () => toast.error('เกิดข้อผิดพลาด'),
  })

  const handleEditFarm = () => {
    setFarmForm({ name: farm.name, description: farm.description || '', location: farm.location, province: farm.province })
    setEditingFarm(true)
  }

  const handleSubmitReview = async () => {
    if (!reviewRating) return
    setReviewSubmitting(true)
    try {
      await api.post(`/farms/${id}/reviews`, { rating: reviewRating, comment: reviewComment.trim() || undefined })
      toast.success('ขอบคุณสำหรับรีวิว!')
      setShowReviewForm(false)
      setReviewRating(0)
      setReviewComment('')
      refetchReviews()
      qc.invalidateQueries({ queryKey: ['farm-can-review', id] })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'เกิดข้อผิดพลาด')
    } finally {
      setReviewSubmitting(false)
    }
  }

  if (isLoading) return <div className="animate-pulse bg-gray-100 h-96 rounded-2xl" />
  if (!farm) return <div className="text-center py-20 text-gray-500">ไม่พบฟาร์ม</div>

  return (
    <div className="space-y-8">
      {/* Farm Header */}
      <div className="bg-white rounded-2xl overflow-hidden border border-gray-100">

        {/* Slideshow */}
        <div className="relative h-64 bg-gray-100 overflow-hidden">
          {slideImages.length > 0 ? (
            <>
              <img
                src={slideImages[slideIndex]}
                alt={`${farm.name} ${slideIndex + 1}`}
                className="w-full h-full object-cover transition-opacity duration-300"
              />
              {slideImages.length > 1 && (
                <>
                  <button
                    onClick={() => setSlideIndex((i) => (i - 1 + slideImages.length) % slideImages.length)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full w-8 h-8 flex items-center justify-center transition"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    onClick={() => setSlideIndex((i) => (i + 1) % slideImages.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full w-8 h-8 flex items-center justify-center transition"
                  >
                    <ChevronRight size={18} />
                  </button>
                  <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
                    {slideImages.map((_, i) => (
                      <button key={i} onClick={() => setSlideIndex(i)}
                        className={`w-2 h-2 rounded-full transition ${i === slideIndex ? 'bg-white' : 'bg-white/50'}`} />
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-8xl">🏡</div>
          )}
        </div>

        <div className="p-6">
          {/* Farm info display / edit */}
          {editingFarm ? (
            <div className="space-y-3">
              <input value={farmForm.name} onChange={(e) => setFarmForm({ ...farmForm, name: e.target.value })}
                placeholder="ชื่อฟาร์ม" className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 font-semibold text-lg" />
              <input value={farmForm.location} onChange={(e) => setFarmForm({ ...farmForm, location: e.target.value })}
                placeholder="ที่ตั้ง" className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm" />
              <select value={farmForm.province} onChange={(e) => setFarmForm({ ...farmForm, province: e.target.value })}

                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm">
                <option value="">เลือกจังหวัด</option>
                {provinces.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <textarea value={farmForm.description} onChange={(e) => setFarmForm({ ...farmForm, description: e.target.value })}
                placeholder="คำอธิบายฟาร์ม" rows={3}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm resize-none" />
              <div className="flex gap-2">
                <button onClick={() => updateFarm.mutate()} disabled={updateFarm.isPending}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition disabled:opacity-50 text-sm">
                  <Save size={14} /> {updateFarm.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
                <button onClick={() => setEditingFarm(false)}
                  className="btn-cancel flex items-center gap-2">
                  <X size={14} /> ยกเลิก
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold text-green-600">{farm.name}</h1>
                <p className="text-gray-600 flex items-center gap-1 mt-1"><MapPin size={14} /> {farm.location}, {farm.province}</p>
                {farm.description && <p className="text-gray-700 mt-3 text-sm">{farm.description}</p>}
                <p className="text-sm text-gray-500 mt-2 flex items-center gap-2 flex-wrap">
                  <Package size={14} /> {farm.products?.length ?? 0} สินค้า · เจ้าของ: {farm.user?.name}
                  <span className="flex items-center gap-1">
                    {[1,2,3,4,5].map((s) => (
                      <Star key={s} size={13} className={s <= Math.round(farmReviewsData?.avg ?? 0) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'} />
                    ))}
                    <span className="text-gray-500 text-sm">
                      {farmReviewsData?.total > 0 ? `${farmReviewsData.avg.toFixed(1)} (${farmReviewsData.total} รีวิว)` : 'ยังไม่มีรีวิว'}
                    </span>
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                {farm.isVerified ? (
                  <span className="flex items-center gap-1 text-green-600 text-sm bg-green-50 px-3 py-1 rounded-full">
                    <CheckCircle size={14} /> ยืนยันแล้ว
                  </span>
                ) : isOwner && farm.isSuspended ? (
                  <span className="flex items-center gap-1 text-orange-600 text-sm bg-orange-50 px-3 py-1 rounded-full">
                    <AlertCircle size={14} /> ระงับการใช้งาน
                  </span>
                ) : isOwner && farm.rejectReason ? (
                  <span className="flex items-center gap-1 text-red-600 text-sm bg-red-50 px-3 py-1 rounded-full">
                    <AlertCircle size={14} /> ถูกปฏิเสธ
                  </span>
                ) : isOwner && !farm.isVerified ? (
                  <span className="flex items-center gap-1 text-yellow-600 text-sm bg-yellow-50 px-3 py-1 rounded-full">
                    <AlertCircle size={14} /> รอการอนุมัติ
                  </span>
                ) : null}
                {/* Like button */}
                {!isOwner && (
                  <button
                    onClick={() => isAuthenticated ? toggleLike.mutate() : openLogin()}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition ${likeStatus?.liked ? 'bg-red-50 border-red-300 text-red-500' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                  >
                    <Heart size={14} className={likeStatus?.liked ? 'fill-red-500' : ''} />
                    {likeStatus?.count ?? 0}
                  </button>
                )}
                {isOwner && (
                  <button onClick={handleEditFarm}
                    className="flex items-center gap-1 border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition text-sm">
                    <Edit size={14} /> แก้ไขข้อมูล
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Video Section */}
      {farmVideos.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-600 flex items-center gap-2"><Play size={18} className="text-green-600" /> วิดีโอแนะนำฟาร์ม</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {farmVideos.map((url, idx) => {
              const embedUrl = getVideoEmbed(url)
              const isTikTok = url.includes('tiktok.com')
              if (embedUrl) {
                return (
                  <div key={idx} className="bg-white rounded-xl overflow-hidden border border-gray-100">
                    <iframe
                      src={embedUrl}
                      className="w-full aspect-video"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                )
              }
              return (
                <a key={idx} href={url} target="_blank" rel="noopener noreferrer"
                  className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3 hover:border-green-300 transition">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    {isTikTok ? <span className="text-lg">🎵</span> : <Play size={18} className="text-gray-600" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800">{isTikTok ? 'TikTok' : 'Video'}</p>
                    <p className="text-sm text-gray-500 truncate">{url}</p>
                  </div>
                </a>
              )
            })}
          </div>
        </div>
      )}

      {/* Suspended / Rejected Banner */}
      {isOwner && !farm.isVerified && (farm.rejectReason || farm.isSuspended) && (
        <div className={`border rounded-xl p-5 space-y-3 ${farm.isSuspended ? 'bg-orange-50 border-orange-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-start gap-2">
            <AlertCircle size={18} className={`mt-0.5 flex-shrink-0 ${farm.isSuspended ? 'text-orange-500' : 'text-red-500'}`} />
            <div>
              <p className={`font-semibold ${farm.isSuspended ? 'text-orange-700' : 'text-red-700'}`}>
                {farm.isSuspended ? 'ฟาร์มถูกระงับการใช้งาน' : 'ฟาร์มถูกปฏิเสธ'}
              </p>
              {farm.rejectReason && (
                <p className={`text-sm mt-1 ${farm.isSuspended ? 'text-orange-600' : 'text-red-600'}`}>
                  <span className="font-medium">ข้อความจาก Admin:</span> {farm.rejectReason}
                </p>
              )}
            </div>
          </div>
          <p className={`text-sm ${farm.isSuspended ? 'text-orange-500' : 'text-red-500'}`}>
            กรุณาแก้ไขข้อมูลฟาร์มตามที่แจ้ง แล้วยื่นขออนุมัติใหม่พร้อมชี้แจง
          </p>
          {!showResubmitForm ? (
            <button onClick={() => setShowResubmitForm(true)}
              className={`flex items-center gap-2 text-white px-4 py-2 rounded-lg transition text-sm ${farm.isSuspended ? 'bg-orange-500 hover:bg-orange-600' : 'bg-red-600 hover:bg-red-700'}`}>
              <RefreshCw size={14} /> ยื่นขออนุมัติใหม่
            </button>
          ) : (
            <div className="space-y-2">
              <p className={`text-sm font-medium ${farm.isSuspended ? 'text-orange-700' : 'text-red-700'}`}>
                ข้อความถึง Admin (ระบุสิ่งที่แก้ไขแล้ว)
              </p>
              <textarea
                value={resubmitMessage}
                onChange={(e) => setResubmitMessage(e.target.value)}
                placeholder="เช่น ได้แก้ไขข้อมูลฟาร์ม เพิ่มรูปภาพ และปรับปรุงรายละเอียดสินค้าเรียบร้อยแล้ว..."
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 resize-none"
              />
              <div className="flex gap-2">
                <button onClick={() => resubmit.mutate(resubmitMessage)} disabled={resubmit.isPending}
                  className={`flex items-center gap-2 text-white px-4 py-2 rounded-lg transition text-sm disabled:opacity-50 ${farm.isSuspended ? 'bg-orange-500 hover:bg-orange-600' : 'bg-red-600 hover:bg-red-700'}`}>
                  <RefreshCw size={14} /> {resubmit.isPending ? 'กำลังส่ง...' : 'ยืนยันยื่นขออนุมัติ'}
                </button>
                <button onClick={() => { setShowResubmitForm(false); setResubmitMessage('') }} className="btn-cancel">
                  ยกเลิก
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Products Section */}
      <div id="products" className="scroll-mt-16">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-600">สินค้าของฟาร์ม</h2>
          {isOwner && (
            <button onClick={() => setAddingProduct(true)}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition text-sm">
              <Plus size={16} /> เพิ่มสินค้า
            </button>
          )}
        </div>

        {/* Add Product Form */}
        {addingProduct && (
          <div className="bg-white rounded-xl p-6 border border-green-200 mb-6">
            <h3 className="font-semibold text-gray-600 mb-4">เพิ่มสินค้าใหม่</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="text-sm text-gray-600 mb-1 block">ชื่อสินค้า</label>
                <input value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  placeholder="เช่น มะม่วงน้ำดอกไม้" className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm" />
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">หมวดหมู่</label>
                <select value={productForm.categoryId} onChange={(e) => setProductForm({ ...productForm, categoryId: e.target.value })}

                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm">
                  <option value="">เลือกหมวดหมู่</option>
                  {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-600 mb-1 block">ราคา (บาท)</label>
                  <input type="number" min="0" value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                    placeholder="0" className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm" />
                </div>
                <div>
                  <label className="text-sm text-gray-600 mb-1 block">หน่วย</label>
                  <select value={productForm.unit} onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })}

                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm">
                    {units.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">สต็อก</label>
                <input type="number" min="0" value={productForm.stock} onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })}
                  placeholder="0" className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm" />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm text-gray-600 mb-1 block">คำอธิบาย</label>
                <textarea value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  rows={2} placeholder="รายละเอียดสินค้า..."
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm resize-none" />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm text-gray-600 mb-2 block">รูปภาพสินค้า</label>
                <div className="flex flex-wrap gap-3">
                  {productForm.images.map((img, i) => (
                    <div key={i} className="relative w-24 h-24 rounded-lg overflow-hidden border border-gray-200">
                      <img src={img} alt="" className="w-full h-full object-cover" />
                      <button onClick={() => setProductForm({ ...productForm, images: productForm.images.filter((_, idx) => idx !== i) })}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-sm">
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                  {productForm.images.length < 5 && (
                    <ImageUpload
                      currentImage={null}
                      onUploaded={(url) => setProductForm({ ...productForm, images: [...productForm.images, url] })}
                      height="h-24"
                      width="w-24"
                    />
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-1">อัพโหลดได้สูงสุด 5 รูป</p>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => addProduct.mutate()} disabled={addProduct.isPending || !productForm.name || !productForm.price || !productForm.categoryId}
                className="flex items-center gap-2 bg-green-600 text-white px-5 py-2 rounded-lg hover:bg-green-700 transition disabled:opacity-50 text-sm">
                <Save size={14} /> {addProduct.isPending ? 'กำลังบันทึก...' : 'บันทึกสินค้า'}
              </button>
              <button onClick={() => setAddingProduct(false)}
                className="btn-cancel flex items-center gap-2">
                <X size={14} /> ยกเลิก
              </button>
            </div>
          </div>
        )}

        {/* Products Grid */}
        {products.length === 0 && !addingProduct ? (
          <div className="text-center py-16 text-gray-500">
            <Package size={40} className="mx-auto mb-3 opacity-40" />
            <p>ยังไม่มีสินค้า</p>
            {isOwner && <button onClick={() => setAddingProduct(true)} className="mt-3 text-green-600 text-sm hover:underline">+ เพิ่มสินค้าแรก</button>}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {products.map((p: Product) => (
              <div key={p.id} className={`relative ${!p.isActive ? 'opacity-50' : ''}`}>
                <ProductCard product={p} />
                {!p.isActive && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="bg-gray-800/70 text-white text-sm px-2 py-1 rounded-full flex items-center gap-1">
                      <EyeOff size={10} /> ซ่อนอยู่
                    </span>
                  </div>
                )}
                {isOwner && (
                  <div className="absolute top-2 left-2 flex gap-1">
                    <button onClick={() => toggleProduct.mutate({ pid: p.id, isActive: !p.isActive })}
                      title={p.isActive ? 'ซ่อนสินค้า' : 'แสดงสินค้า'}
                      className={`p-1.5 rounded-lg text-white text-sm shadow ${p.isActive ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-500 hover:bg-green-600'} transition`}>
                      {p.isActive ? <EyeOff size={12} /> : <Eye size={12} />}
                    </button>
                    <button onClick={() => router.push(`/seller/products/${p.id}/edit`)}
                      title="แก้ไขสินค้า"
                      className="p-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white shadow transition">
                      <Edit size={12} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Farm Reviews Section */}
      <div id="reviews" className="scroll-mt-16">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-600">รีวิวฟาร์ม</h2>
            {farmReviewsData?.total > 0 && (
              <div className="flex items-center gap-1 mt-1 ml-1">
                {[1,2,3,4,5].map((s) => (
                  <Star key={s} size={14} className={s <= Math.round(farmReviewsData.avg) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'} />
                ))}
                <span className="text-sm text-gray-500 ml-1">
                  {farmReviewsData.avg.toFixed(1)} · {farmReviewsData.total} รีวิว
                </span>
              </div>
            )}
          </div>
          {canReviewData?.canReview && !showReviewForm && (
            <button
              onClick={() => {
                setReviewRating(canReviewData.existingReview?.rating ?? 0)
                setReviewComment(canReviewData.existingReview?.comment ?? '')
                setShowReviewForm(true)
              }}
              className="self-start sm:self-auto flex items-center gap-1.5 border border-green-500 text-green-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-50 transition"
            >
              <Star size={14} />
              {canReviewData.hasReviewed ? 'แก้ไขรีวิว' : 'เขียนรีวิว'}
            </button>
          )}
        </div>

        {/* Inline review form */}
        {showReviewForm && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5 mb-5 space-y-4">
            <p className="font-semibold text-gray-800">แสดงความคิดเห็นของคุณ</p>

            {/* Star selector */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="flex gap-1">
                {[1,2,3,4,5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setReviewRating(s)}
                    onMouseEnter={() => setReviewHover(s)}
                    onMouseLeave={() => setReviewHover(0)}
                    className="transition-transform hover:scale-110 active:scale-95"
                  >
                    <Star size={32} className={s <= (reviewHover || reviewRating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'} />
                  </button>
                ))}
              </div>
              {reviewRating > 0 && (
                <span className="text-sm text-yellow-600 font-medium">
                  {['','ไม่ดีเลย','พอใช้ได้','โอเค','ดีมาก','ยอดเยี่ยม!'][reviewRating]}
                </span>
              )}
            </div>

            <textarea
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              placeholder="แสดงความคิดเห็นเกี่ยวกับฟาร์มนี้ (ไม่บังคับ)"
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none bg-white"
            />

            <div className="flex gap-3">
              <button
                onClick={handleSubmitReview}
                disabled={reviewRating === 0 || reviewSubmitting}
                className="flex-1 sm:flex-none bg-green-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-green-700 transition disabled:opacity-50"
              >
                {reviewSubmitting ? 'กำลังส่ง...' : 'ส่งรีวิว'}
              </button>
              <button
                onClick={() => setShowReviewForm(false)}
                className="flex-1 sm:flex-none border border-gray-300 text-gray-700 px-6 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        )}

        {/* Reviews list */}
        {farmReviewsData?.total > 0 ? (
          <div className="space-y-3">
            {farmReviewsData.reviews.map((review: { id: string; user: { name: string; avatar: string | null }; rating: number; comment: string | null; createdAt: string }) => (
              <div key={review.id} className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-100 flex gap-3 sm:gap-4">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 overflow-hidden">
                  {review.user.avatar
                    ? <img src={review.user.avatar} alt={review.user.name} className="w-full h-full object-cover" />
                    : review.user.name?.[0]?.toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  {/* Name + stars + date */}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1">
                    <span className="font-semibold text-sm text-gray-800">{review.user.name}</span>
                    <span className="flex gap-0.5">
                      {[1,2,3,4,5].map((s) => (
                        <Star key={s} size={12} className={s <= review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'} />
                      ))}
                    </span>
                    <span className="text-sm text-gray-500 sm:ml-auto">
                      {new Date(review.createdAt).toLocaleDateString('th-TH', { dateStyle: 'medium' })}
                    </span>
                  </div>
                  {review.comment && (
                    <p className="text-sm text-gray-700 leading-relaxed">{review.comment}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500 bg-white rounded-2xl border border-gray-100">
            <Star size={36} className="mx-auto mb-3 opacity-20" />
            <p className="font-medium text-gray-600">ยังไม่มีรีวิวฟาร์มนี้</p>
            {canReviewData?.canReview ? (
              <>
                <p className="text-sm mt-1">เป็นคนแรกที่แบ่งปันประสบการณ์</p>
                {!showReviewForm && (
                  <button
                    onClick={() => setShowReviewForm(true)}
                    className="mt-3 bg-green-600 text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-green-700 transition"
                  >
                    เขียนรีวิว
                  </button>
                )}
              </>
            ) : (
              <p className="text-sm mt-1 text-gray-500">สมาชิกที่สั่งซื้อสินค้ากับทางฟาร์มเท่านั้น สามารถเขียนรีวิวได้</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
