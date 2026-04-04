import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'สินค้าเกษตรทั้งหมด',
  description: 'เลือกซื้อสินค้าเกษตรสดใหม่หลากหลายชนิด ผัก ผลไม้ ธัญพืช ตรงจากฟาร์ม',
  openGraph: {
    title: 'สินค้าเกษตรทั้งหมด - FarmDirect',
    description: 'เลือกซื้อสินค้าเกษตรสดใหม่หลากหลายชนิด ผัก ผลไม้ ธัญพืช ตรงจากฟาร์ม',
  },
}

export default function ProductsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
