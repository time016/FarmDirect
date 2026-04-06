import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'
import ConditionalFooter from '@/components/ConditionalFooter'
import AuthModal from '@/components/AuthModal'
import Providers from './providers'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: { default: 'FarmDirect - สินค้าเกษตรจากฟาร์มสู่มือคุณ', template: '%s - FarmDirect' },
  description: 'ซื้อสินค้าเกษตรคุณภาพดีตรงจากฟาร์ม ไม่ผ่านพ่อค้าคนกลาง รับประกันความสดใหม่',
  keywords: ['สินค้าเกษตร', 'ฟาร์มออนไลน์', 'ผักปลอดสาร', 'ผลไม้สด', 'FarmDirect'],
  openGraph: {
    siteName: 'FarmDirect',
    type: 'website',
    locale: 'th_TH',
    title: 'FarmDirect - สินค้าเกษตรจากฟาร์มสู่มือคุณ',
    description: 'ซื้อสินค้าเกษตรคุณภาพดีตรงจากฟาร์ม ไม่ผ่านพ่อค้าคนกลาง',
  },
  twitter: { card: 'summary_large_image' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body className={`${geist.className} bg-gray-50 min-h-screen`}>
        <Providers>
          <Navbar />
          <main className="max-w-7xl mx-auto px-0 sm:px-4 py-6">{children}</main>
          <ConditionalFooter />
          <AuthModal />
        </Providers>
      </body>
    </html>
  )
}
