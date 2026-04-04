'use client'
import { useEffect, useRef, useState } from 'react'
import { X, ZoomIn, ZoomOut } from 'lucide-react'

const PREVIEW = 280  // display size (px)
const OUTPUT  = 400  // exported canvas size (px)

interface Props {
  file: File
  onConfirm: (blob: Blob) => void
  onCancel: () => void
}

export default function AvatarCropModal({ file, onConfirm, onCancel }: Props) {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef       = useRef<HTMLImageElement | null>(null)
  const [minZoom, setMinZoom] = useState(1)
  const [zoom, setZoom]       = useState(1)
  const [pan, setPan]         = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)

  // persist latest values in refs for use inside event handlers
  const zoomRef = useRef(zoom)
  const panRef  = useRef(pan)
  zoomRef.current = zoom
  panRef.current  = pan

  const dragRef = useRef({ active: false, startX: 0, startY: 0, panX: 0, panY: 0 })
  const touchRef = useRef({ startX: 0, startY: 0, panX: 0, panY: 0, initialDist: 0, initialZoom: 1, numTouches: 0 })

  // Load image and compute initial "fill" zoom
  useEffect(() => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      const fill = Math.max(PREVIEW / img.naturalWidth, PREVIEW / img.naturalHeight)
      setMinZoom(fill)
      setZoom(fill)
      setPan({ x: 0, y: 0 })
    }
    img.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  // Redraw canvas on every state change
  useEffect(() => {
    const img = imgRef.current
    const canvas = canvasRef.current
    if (!img || !canvas) return
    const ctx = canvas.getContext('2d')!
    const s = PREVIEW

    ctx.clearRect(0, 0, s, s)

    // Dim background
    ctx.fillStyle = '#e5e7eb'
    ctx.fillRect(0, 0, s, s)

    // Circular clip
    ctx.save()
    ctx.beginPath()
    ctx.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2)
    ctx.clip()

    const w = img.naturalWidth  * zoom
    const h = img.naturalHeight * zoom
    const x = s / 2 - w / 2 + pan.x
    const y = s / 2 - h / 2 + pan.y
    ctx.drawImage(img, x, y, w, h)
    ctx.restore()

    // Circle border
    ctx.beginPath()
    ctx.arc(s / 2, s / 2, s / 2 - 1.5, 0, Math.PI * 2)
    ctx.strokeStyle = 'white'
    ctx.lineWidth = 3
    ctx.stroke()
  }, [zoom, pan])

  // Non-passive touchmove (needed for e.preventDefault to work)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handler = (e: TouchEvent) => {
      e.preventDefault()
      const t = touchRef.current
      if (e.touches.length === 1) {
        const dx = e.touches[0].clientX - t.startX
        const dy = e.touches[0].clientY - t.startY
        setPan({ x: t.panX + dx, y: t.panY + dy })
      } else if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[1].clientX - e.touches[0].clientX,
          e.touches[1].clientY - e.touches[0].clientY,
        )
        setZoom(Math.min(minZoom * 5, Math.max(minZoom, t.initialZoom * (dist / t.initialDist))))
      }
    }
    el.addEventListener('touchmove', handler, { passive: false })
    return () => el.removeEventListener('touchmove', handler)
  }, [minZoom])

  // Mouse drag
  const onMouseDown = (e: React.MouseEvent) => {
    dragRef.current = { active: true, startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y }
    setIsDragging(true)
  }
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current.active) return
    setPan({
      x: dragRef.current.panX + (e.clientX - dragRef.current.startX),
      y: dragRef.current.panY + (e.clientY - dragRef.current.startY),
    })
  }
  const onMouseUp = () => { dragRef.current.active = false; setIsDragging(false) }

  // Scroll wheel zoom
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    setZoom((z) => Math.min(minZoom * 5, Math.max(minZoom, z - e.deltaY * 0.004)))
  }

  // Touch start
  const onTouchStart = (e: React.TouchEvent) => {
    const t = touchRef.current
    t.numTouches = e.touches.length
    if (e.touches.length === 1) {
      t.startX = e.touches[0].clientX; t.startY = e.touches[0].clientY
      t.panX   = panRef.current.x;     t.panY   = panRef.current.y
    } else if (e.touches.length === 2) {
      t.initialDist = Math.hypot(
        e.touches[1].clientX - e.touches[0].clientX,
        e.touches[1].clientY - e.touches[0].clientY,
      )
      t.initialZoom = zoomRef.current
    }
  }

  // Export cropped circle as Blob and call onConfirm
  const handleConfirm = () => {
    const img = imgRef.current
    if (!img) return
    const out = document.createElement('canvas')
    out.width = out.height = OUTPUT
    const ctx = out.getContext('2d')!
    const ratio = OUTPUT / PREVIEW

    ctx.beginPath()
    ctx.arc(OUTPUT / 2, OUTPUT / 2, OUTPUT / 2, 0, Math.PI * 2)
    ctx.clip()

    const w = img.naturalWidth  * zoom * ratio
    const h = img.naturalHeight * zoom * ratio
    const x = OUTPUT / 2 - w / 2 + pan.x * ratio
    const y = OUTPUT / 2 - h / 2 + pan.y * ratio
    ctx.drawImage(img, x, y, w, h)

    out.toBlob((blob) => { if (blob) onConfirm(blob) }, 'image/jpeg', 0.92)
  }

  const zoomPct = minZoom > 0 ? Math.round(((zoom - minZoom) / (minZoom * 4)) * 100) : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-800 text-lg">ปรับรูปโปรไฟล์</h2>
          <button onClick={onCancel} className="text-gray-500 hover:text-gray-700 transition p-1">
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <p className="text-sm text-gray-500 text-center">
            ลากเพื่อจัดตำแหน่ง · เลื่อนล้อหรือบีบนิ้วเพื่อซูม
          </p>

          {/* Canvas */}
          <div
            ref={containerRef}
            className="flex justify-center"
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onWheel={onWheel}
            onTouchStart={onTouchStart}
            style={{ cursor: isDragging ? 'grabbing' : 'grab', userSelect: 'none' }}
          >
            <canvas
              ref={canvasRef}
              width={PREVIEW}
              height={PREVIEW}
              className="rounded-full shadow-md"
              style={{ width: PREVIEW, height: PREVIEW }}
            />
          </div>

          {/* Zoom slider */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setZoom((z) => Math.max(minZoom, z - minZoom * 0.1))}
              className="text-gray-600 hover:text-green-600 transition flex-shrink-0"
            >
              <ZoomOut size={18} />
            </button>
            <div className="relative flex-1">
              <input
                type="range"
                min={minZoom}
                max={minZoom * 5}
                step={minZoom * 0.02}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full accent-green-600"
              />
            </div>
            <button
              onClick={() => setZoom((z) => Math.min(minZoom * 5, z + minZoom * 0.1))}
              className="text-gray-600 hover:text-green-600 transition flex-shrink-0"
            >
              <ZoomIn size={18} />
            </button>
            <span className="text-sm text-gray-500 w-10 text-right tabular-nums">{zoomPct}%</span>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-1">
            <button onClick={onCancel}
              className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition">
              ยกเลิก
            </button>
            <button onClick={handleConfirm}
              className="flex-1 py-2.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition">
              ใช้รูปนี้
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
