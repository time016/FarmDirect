import type { Metadata } from 'next'
import FarmDetailClient from './FarmDetailClient'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  try {
    const res = await fetch(`${API}/farms/${slug}`, { next: { revalidate: 60 } })
    if (!res.ok) return { title: 'ฟาร์ม' }
    const farm = await res.json()
    const description = farm.description ?? `สินค้าเกษตรคุณภาพจาก ${farm.name} จังหวัด${farm.province}`
    return {
      title: farm.name,
      description,
      openGraph: {
        title: farm.name,
        description,
        images: farm.image ? [{ url: farm.image }] : [],
        type: 'website',
      },
    }
  } catch {
    return { title: 'ฟาร์ม' }
  }
}

export default function FarmDetailPage() {
  return <FarmDetailClient />
}
