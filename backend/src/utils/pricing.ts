import prisma from '../config/database'

export interface PricingConfig {
  pricingModel: string   // 'A' | 'B'
  commissionRate: number
  vatEnabled: boolean
  vatRate: number
}

export async function getActivePricingConfig(): Promise<PricingConfig> {
  return prisma.pricingConfig.upsert({
    where: { id: 'default' },
    create: { id: 'default' },
    update: {},
  })
}

/**
 * คำนวณราคาที่ลูกค้าจ่ายจริง (displayPrice)
 *
 * Option A — หัก % จากฟาร์ม:
 *   ลูกค้าจ่าย = basePrice + VAT(basePrice)
 *   ฟาร์มได้รับ = basePrice − commission
 *
 * Option B — บวก % ให้ลูกค้า:
 *   ลูกค้าจ่าย = basePrice + commission + VAT(basePrice)
 *   ฟาร์มได้รับ = basePrice
 */
export function calcDisplayPrice(basePrice: number, config: PricingConfig): number {
  const vat = config.vatEnabled ? config.vatRate : 0
  const markup = config.pricingModel === 'B' ? config.commissionRate : 0
  return Math.round(basePrice * (1 + markup + vat) * 100) / 100
}

/** ราคาที่ฟาร์มได้รับหลังหัก commission (Option A เท่านั้น) */
export function calcFarmReceives(basePrice: number, config: PricingConfig): number {
  if (config.pricingModel === 'A') {
    return Math.round(basePrice * (1 - config.commissionRate) * 100) / 100
  }
  return basePrice
}
