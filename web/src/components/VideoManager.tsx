'use client'
import { useState } from 'react'
import { Plus, Trash2, Youtube, Facebook, Video } from 'lucide-react'

function detectType(url: string): 'youtube' | 'facebook' | 'tiktok' | 'other' {
  if (/youtube\.com|youtu\.be/.test(url)) return 'youtube'
  if (/facebook\.com/.test(url)) return 'facebook'
  if (/tiktok\.com/.test(url)) return 'tiktok'
  return 'other'
}

const META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  youtube:  { label: 'YouTube',  icon: <Youtube size={13} />,  color: 'text-red-500' },
  facebook: { label: 'Facebook', icon: <Facebook size={13} />, color: 'text-blue-600' },
  tiktok:   { label: 'TikTok',   icon: <Video size={13} />,    color: 'text-gray-800' },
  other:    { label: 'Video',    icon: <Video size={13} />,    color: 'text-gray-600' },
}

export default function VideoManager({ videos, onChange }: { videos: string[]; onChange: (v: string[]) => void }) {
  const [input, setInput] = useState('')

  const add = () => {
    const url = input.trim()
    if (!url || videos.includes(url)) return
    onChange([...videos, url])
    setInput('')
  }

  return (
    <div className="space-y-2">
      {videos.map((url, idx) => {
        const type = detectType(url)
        const meta = META[type]
        return (
          <div key={idx} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
            <span className={`flex items-center gap-1 text-sm font-medium flex-shrink-0 ${meta.color}`}>
              {meta.icon} {meta.label}
            </span>
            <span className="text-sm text-gray-600 truncate flex-1">{url}</span>
            <button onClick={() => onChange(videos.filter((_, i) => i !== idx))} className="text-gray-500 hover:text-red-500 transition flex-shrink-0">
              <Trash2 size={13} />
            </button>
          </div>
        )
      })}
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder="วาง URL YouTube / Facebook / TikTok"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <button type="button" onClick={add}
          className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition">
          <Plus size={14} />
        </button>
      </div>
    </div>
  )
}
