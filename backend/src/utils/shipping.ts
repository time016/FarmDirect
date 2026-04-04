import prisma from '../config/database'

export interface ShippingConfig {
  baseRate: number
  weightLimitKg: number
  perKgRate: number
  freeThreshold: number
  minBaseRate: number
  maxBaseRate: number
}

export interface FarmShippingOverride {
  shippingRate?: number | null
  shippingWeightLimitKg?: number | null
  shippingPerKgRate?: number | null
  shippingFreeThreshold?: number | null
}

export async function getActiveShippingConfig(): Promise<ShippingConfig> {
  return prisma.shippingConfig.upsert({
    where: { id: 'default' },
    create: { id: 'default' },
    update: {},
  })
}

/** น้ำหนักรวมของ order item (kg) */
function getItemWeightKg(unit: string, quantity: number, weightKg: number): number {
  if (unit === 'กิโลกรัม') return quantity
  if (unit === 'กรัม') return quantity / 1000
  return weightKg * quantity
}

export interface ShippingItem {
  quantity: number
  product: { unit: string; weightKg: number }
}

export interface ShippingResult {
  shippingFee: number
  totalWeightKg: number
  isFree: boolean
  breakdown: string
}

/**
 * คำนวณค่าส่ง — farm override แต่ละ field ถ้าไม่ได้กำหนดจะใช้ค่า platform
 */
export function calcShipping(
  items: ShippingItem[],
  subtotal: number,
  config: ShippingConfig,
  farmOverride: FarmShippingOverride | number | null = null,
): ShippingResult {
  // backward-compat: ถ้าส่งมาเป็น number ตรงๆ ให้แปลงเป็น override
  const override: FarmShippingOverride =
    farmOverride === null ? {} :
    typeof farmOverride === 'number' ? { shippingRate: farmOverride } :
    farmOverride

  const totalWeightKg = items.reduce((sum, item) =>
    sum + getItemWeightKg(item.product.unit, item.quantity, item.product.weightKg), 0)

  const freeThreshold = override.shippingFreeThreshold ?? config.freeThreshold

  if (subtotal >= freeThreshold) {
    return { shippingFee: 0, totalWeightKg, isFree: true, breakdown: `ฟรีค่าส่ง (ยอดสั่งซื้อ ≥ ฿${freeThreshold})` }
  }

  const baseRate = override.shippingRate !== null && override.shippingRate !== undefined
    ? Math.max(config.minBaseRate, Math.min(config.maxBaseRate, override.shippingRate))
    : config.baseRate

  const weightLimitKg = override.shippingWeightLimitKg ?? config.weightLimitKg
  const perKgRate = override.shippingPerKgRate ?? config.perKgRate

  if (totalWeightKg <= weightLimitKg) {
    return { shippingFee: baseRate, totalWeightKg, isFree: false, breakdown: `฿${baseRate} (น้ำหนัก ${totalWeightKg.toFixed(2)} kg)` }
  }

  const excessKg = totalWeightKg - weightLimitKg
  const extra = Math.ceil(excessKg) * perKgRate
  const shippingFee = baseRate + extra
  return {
    shippingFee,
    totalWeightKg,
    isFree: false,
    breakdown: `฿${baseRate} + ฿${perKgRate}×${Math.ceil(excessKg)}kg เกิน = ฿${shippingFee}`,
  }
}
