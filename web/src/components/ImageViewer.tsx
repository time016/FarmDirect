'use client'
import { useEffect, useRef, useState } from 'react'
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'

interface Props {
  images: string[]
  initialIndex?: number
  onClose: () => void
}

function getDist(t1: { clientX: number; clientY: number }, t2: { clientX: number; clientY: number }) {
  return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
}
function getMid(t1: { clientX: number; clientY: number }, t2: { clientX: number; clientY: number }) {
  return { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 }
}

export default function ImageViewer({ images, initialIndex = 0, onClose }: Props) {
  const [index, setIndex] = useState(initialIndex)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [transitioning, setTransitioning] = useState(false)

  // Refs to avoid stale closures in touch/mouse handlers
  const stateRef = useRef({ index, zoom, pan, transitioning })
  stateRef.current = { index, zoom, pan, transitioning }

  const containerRef = useRef<HTMLDivElement>(null)

  // Mouse drag
  const mouseRef = useRef({ active: false, startX: 0, startY: 0, panX: 0, panY: 0 })

  // Touch state
  const touchRef = useRef({
    startX: 0, startY: 0,
    panX: 0, panY: 0,
    initialDist: 0, initialZoom: 1,
    midX: 0, midY: 0, midPanX: 0, midPanY: 0,
    lastTap: 0,
    numTouches: 0,
  })

  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }) }

  const goTo = (i: number) => {
    setIndex((i + images.length) % images.length)
    resetView()
  }

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const { index } = stateRef.current
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') goTo(index - 1)
      if (e.key === 'ArrowRight') goTo(index + 1)
      if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(4, z + 0.5))
      if (e.key === '-') setZoom((z) => { const nz = Math.max(1, z - 0.5); if (nz === 1) setPan({ x: 0, y: 0 }); return nz })
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Attach non-passive touch listeners to prevent page scroll during pinch/swipe
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      const t = touchRef.current
      const { zoom, pan } = stateRef.current

      if (e.touches.length === 1) {
        const dx = e.touches[0].clientX - t.startX
        const dy = e.touches[0].clientY - t.startY
        if (zoom > 1) {
          setPan({ x: t.panX + dx, y: t.panY + dy })
        }
      } else if (e.touches.length === 2) {
        const dist = getDist(e.touches[0], e.touches[1])
        const mid = getMid(e.touches[0], e.touches[1])
        const newZoom = Math.min(4, Math.max(1, t.initialZoom * (dist / t.initialDist)))
        if (newZoom === 1) {
          setPan({ x: 0, y: 0 })
        } else {
          setPan({
            x: t.midPanX + (mid.x - t.midX),
            y: t.midPanY + (mid.y - t.midY),
          })
        }
        setZoom(newZoom)
      }
    }

    el.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => el.removeEventListener('touchmove', onTouchMove)
  }, [])

  // Scroll-wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    setZoom((z) => {
      const nz = Math.min(4, Math.max(1, z - e.deltaY * 0.005))
      if (nz === 1) setPan({ x: 0, y: 0 })
      return nz
    })
  }

  // Mouse handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (stateRef.current.zoom <= 1) return
    e.preventDefault()
    const { pan } = stateRef.current
    mouseRef.current = { active: true, startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y }
  }
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!mouseRef.current.active) return
    setPan({
      x: mouseRef.current.panX + (e.clientX - mouseRef.current.startX),
      y: mouseRef.current.panY + (e.clientY - mouseRef.current.startY),
    })
  }
  const handleMouseUp = () => { mouseRef.current.active = false }

  const handleDoubleClick = () => {
    if (stateRef.current.zoom > 1) resetView()
    else setZoom(2.5)
  }

  // Touch start
  const handleTouchStart = (e: React.TouchEvent) => {
    const t = touchRef.current
    t.numTouches = e.touches.length

    if (e.touches.length === 1) {
      const { pan } = stateRef.current
      t.startX = e.touches[0].clientX
      t.startY = e.touches[0].clientY
      t.panX = pan.x
      t.panY = pan.y

      // Double-tap detection
      const now = Date.now()
      if (now - t.lastTap < 300) {
        if (stateRef.current.zoom > 1) resetView()
        else setZoom(2.5)
      }
      t.lastTap = now

    } else if (e.touches.length === 2) {
      const { zoom, pan } = stateRef.current
      t.initialDist = getDist(e.touches[0], e.touches[1])
      t.initialZoom = zoom
      const mid = getMid(e.touches[0], e.touches[1])
      t.midX = mid.x
      t.midY = mid.y
      t.midPanX = pan.x
      t.midPanY = pan.y
    }
  }

  // Touch end — swipe navigation
  const handleTouchEnd = (e: React.TouchEvent) => {
    const t = touchRef.current
    const { zoom, index } = stateRef.current

    if (e.changedTouches.length === 1 && e.touches.length === 0 && t.numTouches === 1 && zoom <= 1) {
      const dx = e.changedTouches[0].clientX - t.startX
      const dy = e.changedTouches[0].clientY - t.startY
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) goTo(index + 1)
        else goTo(index - 1)
      }
    }
  }

  const zoomIn = () => setZoom((z) => Math.min(4, z + 0.5))
  const zoomOut = () => setZoom((z) => { const nz = Math.max(1, z - 0.5); if (nz === 1) setPan({ x: 0, y: 0 }); return nz })

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col select-none">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
        <span className="text-white/60 text-sm">{index + 1} / {images.length}</span>
        <div className="flex items-center gap-1">
          <button onClick={zoomOut} disabled={zoom <= 1}
            className="text-white/70 hover:text-white transition p-2 rounded-lg hover:bg-white/10 disabled:opacity-30">
            <ZoomOut size={18} />
          </button>
          <span className="text-white/60 text-sm w-12 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
          <button onClick={zoomIn} disabled={zoom >= 4}
            className="text-white/70 hover:text-white transition p-2 rounded-lg hover:bg-white/10 disabled:opacity-30">
            <ZoomIn size={18} />
          </button>
          {zoom > 1 && (
            <button onClick={resetView}
              className="text-white/70 hover:text-white transition p-2 rounded-lg hover:bg-white/10">
              <Maximize2 size={16} />
            </button>
          )}
        </div>
        <button onClick={onClose}
          className="text-white/70 hover:text-white transition p-2 rounded-lg hover:bg-white/10">
          <X size={20} />
        </button>
      </div>

      {/* Main image area */}
      <div
        ref={containerRef}
        className="flex-1 relative flex items-center justify-center overflow-hidden"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={(e) => { if (e.target === e.currentTarget && zoom <= 1) onClose() }}
        style={{ cursor: zoom > 1 ? (mouseRef.current.active ? 'grabbing' : 'grab') : 'zoom-in' }}
      >
        <img
          src={images[index]}
          alt=""
          draggable={false}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transition: mouseRef.current.active ? 'none' : 'transform 0.15s ease',
            maxWidth: '90vw',
            maxHeight: '100%',
            objectFit: 'contain',
            pointerEvents: 'none',
          }}
        />

        {/* Prev / Next — hidden on mobile (use swipe) */}
        {images.length > 1 && (
          <>
            <button onClick={(e) => { e.stopPropagation(); goTo(index - 1) }}
              className="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/70 text-white rounded-full p-3 transition items-center justify-center">
              <ChevronLeft size={24} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); goTo(index + 1) }}
              className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/70 text-white rounded-full p-3 transition items-center justify-center">
              <ChevronRight size={24} />
            </button>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-2 justify-center px-4 py-3 flex-shrink-0 overflow-x-auto">
          {images.map((img, i) => (
            <button key={i} onClick={() => goTo(i)}
              className={`w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden flex-shrink-0 border-2 transition ${i === index ? 'border-white' : 'border-transparent opacity-40 hover:opacity-70'}`}>
              <img src={img} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Hint — desktop only */}
      <p className="hidden sm:block text-center text-white/30 text-sm pb-2 flex-shrink-0">
        ดับเบิลคลิกเพื่อซูม · เลื่อนล้อเมาส์เพื่อซูม · ลากเพื่อเลื่อนภาพ · ESC เพื่อปิด
      </p>
      {/* Hint — mobile only */}
      <p className="sm:hidden text-center text-white/30 text-sm pb-2 flex-shrink-0">
        ปัดซ้าย/ขวาเพื่อเปลี่ยนรูป · บีบนิ้วเพื่อซูม · แตะสองครั้งเพื่อซูม
      </p>
    </div>
  )
}
