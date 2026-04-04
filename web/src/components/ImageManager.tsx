'use client'
import { useRef, useState } from 'react'
import { X, Plus, Link as LinkIcon } from 'lucide-react'
import api from '@/lib/api'
import toast from 'react-hot-toast'

interface Props {
  images: string[]
  onChange: (images: string[]) => void
  maxImages?: number
}

export default function ImageManager({ images, onChange, maxImages = 5 }: Props) {
  const [uploading, setUploading] = useState(false)
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const removeImage = (i: number) => onChange(images.filter((_, idx) => idx !== i))

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('image', file)
      const { data } = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      onChange([...images, data.url])
      toast.success('อัปโหลดสำเร็จ')
    } catch {
      toast.error('อัปโหลดล้มเหลว')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const addUrl = () => {
    const url = urlInput.trim()
    if (!url) return
    onChange([...images, url])
    setUrlInput('')
    setShowUrlInput(false)
  }

  const canAdd = images.length < maxImages

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {images.map((img, i) => (
          <div key={i} className="relative w-24 h-24 rounded-xl overflow-hidden border-2 border-gray-200 group flex-shrink-0">
            <img src={img} alt="" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => removeImage(i)}
              className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition"
            >
              <X size={12} />
            </button>
            {i === 0 && (
              <span className="absolute bottom-0 left-0 right-0 text-center bg-black/50 text-white text-[10px] py-0.5">
                รูปหลัก
              </span>
            )}
          </div>
        ))}

        {canAdd && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1 text-gray-500 hover:border-green-400 hover:text-green-500 transition disabled:opacity-50 flex-shrink-0"
          >
            {uploading ? (
              <div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Plus size={20} />
                <span className="text-[10px]">อัปโหลด</span>
              </>
            )}
          </button>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handleFileUpload}
          disabled={uploading}
        />
      </div>

      {canAdd && (
        showUrlInput ? (
          <div className="flex gap-2">
            <input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addUrl())}
              placeholder="https://example.com/image.jpg"
              autoFocus
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <button type="button" onClick={addUrl}
              className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition">
              เพิ่ม
            </button>
            <button type="button" onClick={() => { setShowUrlInput(false); setUrlInput('') }}
              className="px-3 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition">
              ยกเลิก
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setShowUrlInput(true)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-green-600 transition">
            <LinkIcon size={12} /> ใช้ URL แทน
          </button>
        )
      )}

      <p className="text-sm text-gray-500">
        {images.length}/{maxImages} รูป · รูปแรกจะเป็นรูปหลัก · JPG, PNG, WebP ขนาดไม่เกิน 5MB
      </p>
    </div>
  )
}
