import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ฟาร์มทั้งหมด',
  description: 'รายการฟาร์มเกษตรคุณภาพทั่วประเทศไทย เลือกซื้อสินค้าตรงจากเกษตรกร',
  openGraph: {
    title: 'ฟาร์มทั้งหมด - FarmDirect',
    description: 'รายการฟาร์มเกษตรคุณภาพทั่วประเทศไทย เลือกซื้อสินค้าตรงจากเกษตรกร',
  },
}

export default function FarmsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
