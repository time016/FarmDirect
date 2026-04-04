import { Request, Response, NextFunction } from 'express'
import { Prisma } from '@prisma/client'
import prisma from '../config/database'
import { getActivePricingConfig, calcDisplayPrice } from '../utils/pricing'
import { getActiveShippingConfig } from '../utils/shipping'
import { notify, notifyAllAdmins } from '../utils/notification'

function injectDisplayPrice(products: any[], pricing: any) {
  return products.map((p) => ({ ...p, displayPrice: calcDisplayPrice(Number(p.price), pricing) }))
}

function toSlug(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\u0E00-\u0E7Fa-zA-Z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}

async function generateUniqueSlug(name: string, excludeId?: string): Promise<string> {
  const base = toSlug(name) || 'farm'
  let slug = base
  let n = 2
  while (true) {
    const existing = await prisma.farm.findUnique({ where: { slug } })
    if (!existing || existing.id === excludeId) return slug
    slug = `${base}-${n++}`
  }
}

// Returns the farm owned by userId, or the farm where userId is an ACCEPTED FarmAdmin
export async function getMyFarmByUser(userId: string) {
  const ownedFarm = await prisma.farm.findUnique({ where: { userId } })
  if (ownedFarm) return ownedFarm
  const farmAdmin = await prisma.farmAdmin.findFirst({ where: { userId, status: 'ACCEPTED' }, select: { farm: true } })
  return farmAdmin?.farm ?? null
}

export const createFarm = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.farm.findUnique({ where: { userId: req.user.id } })
    if (existing) return res.status(400).json({ message: 'Farm already exists for this user' })

    const { name, description, location, province, district, subdistrict, zipCode, image } = req.body
    const slug = await generateUniqueSlug(name)
    const farm = await prisma.farm.create({
      data: { userId: req.user.id, slug, name, description, location, province, district, subdistrict, zipCode, image },
    })
    await prisma.farmApprovalLog.create({
      data: { farmId: farm.id, actorId: req.user.id, action: 'SUBMITTED', note: 'ยื่นขอสร้างฟาร์มครั้งแรก' },
    })
    notifyAllAdmins('FARM_SUBMITTED', 'ฟาร์มใหม่รอการอนุมัติ', `ฟาร์ม "${farm.name}" ส่งคำขออนุมัติ`, `/admin/farms`)
    res.status(201).json(farm)
  } catch (err) {
    next(err)
  }
}

async function resolveFarmId(param: string): Promise<string | null> {
  const farm = await prisma.farm.findFirst({
    where: { OR: [{ slug: param }, { id: param }] },
    select: { id: true },
  })
  return farm?.id ?? null
}

export const getFarms = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { province, search, page = 1, limit = 12, sortBy } = req.query
    const pageNum = Number(page)
    const limitNum = Number(limit)
    const where = {
      isVerified: true,
      ...(province && { province: province as string }),
      ...(search && { name: { contains: search as string, mode: 'insensitive' as const } }),
    }

    const include = {
      user: { select: { name: true } },
      farmReviews: { select: { rating: true } },
      _count: { select: { products: true, farmLikes: true } },
    }

    let farms: any[]
    let total: number

    if (sortBy === 'bestseller') {
      // Sum sold quantities per farm via orderItems → products
      const salesRanking = await prisma.orderItem.groupBy({
        by: ['productId'],
        _sum: { quantity: true },
      })
      const productIds = salesRanking.map((s) => s.productId)
      const productFarms = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, farmId: true },
      })
      const farmTotals = new Map<string, number>()
      for (const s of salesRanking) {
        const pf = productFarms.find((p) => p.id === s.productId)
        if (pf) farmTotals.set(pf.farmId, (farmTotals.get(pf.farmId) ?? 0) + (s._sum.quantity ?? 0))
      }
      ;[farms, total] = await Promise.all([
        prisma.farm.findMany({ where, include, take: limitNum * 5 }),
        prisma.farm.count({ where }),
      ])
      farms = farms
        .sort((a, b) => (farmTotals.get(b.id) ?? 0) - (farmTotals.get(a.id) ?? 0))
        .slice((pageNum - 1) * limitNum, pageNum * limitNum)
    } else {
      ;[farms, total] = await Promise.all([
        prisma.farm.findMany({
          where,
          include,
          skip: (pageNum - 1) * limitNum,
          take: limitNum,
        }),
        prisma.farm.count({ where }),
      ])
    }

    res.json({ farms, total, page: pageNum, totalPages: Math.ceil(total / limitNum) })
  } catch (err) {
    next(err)
  }
}

export const getFarm = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const param = req.params['id'] as string
    const include = {
      user: { select: { name: true, phone: true } },
      products: { where: { isActive: true }, include: { category: true, reviews: { select: { rating: true } }, _count: { select: { reviews: true } } } },
    }
    // Look up by slug first, fallback to id for old links
    const farm = await prisma.farm.findFirst({
      where: { OR: [{ slug: param }, { id: param }] },
      include,
    })
    if (!farm) return res.status(404).json({ message: 'Farm not found' })

    // Track farm view (fire-and-forget)
    prisma.farmView.create({ data: { farmId: farm.id } }).catch(() => {})

    const pricing = await getActivePricingConfig()
    res.json({ ...farm, products: injectDisplayPrice(farm.products, pricing) })
  } catch (err) {
    next(err)
  }
}

export const getFarmAnalytics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const farm = await getMyFarmByUser(req.user.id)
    if (!farm) return res.status(404).json({ message: 'Farm not found' })

    const since = new Date()
    since.setDate(since.getDate() - 13)
    since.setHours(0, 0, 0, 0)

    const products = await prisma.product.findMany({
      where: { farmId: farm.id },
      select: { id: true, name: true },
    })
    const productIds = products.map((p) => p.id)
    const productMap = Object.fromEntries(products.map((p) => [p.id, p.name]))

    // 14-day farm views
    const farmViews = await prisma.farmView.findMany({
      where: { farmId: farm.id, viewedAt: { gte: since } },
      select: { viewedAt: true },
    })

    const viewsByDate: Record<string, number> = {}
    for (let i = 0; i < 14; i++) {
      const d = new Date(since)
      d.setDate(d.getDate() + i)
      viewsByDate[d.toISOString().split('T')[0]] = 0
    }
    for (const v of farmViews) {
      const key = v.viewedAt.toISOString().split('T')[0]
      if (key in viewsByDate) viewsByDate[key]++
    }
    const views14days = Object.entries(viewsByDate).map(([date, count]) => ({ date, count }))

    // Most viewed products (last 14 days)
    let topViewedProducts: { id: string; name: string; views: number }[] = []
    if (productIds.length > 0) {
      const pvGroups = await prisma.productView.groupBy({
        by: ['productId'],
        where: { productId: { in: productIds }, viewedAt: { gte: since } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      })
      topViewedProducts = pvGroups.map((pv) => ({
        id: pv.productId,
        name: productMap[pv.productId] ?? '',
        views: pv._count.id,
      }))
    }

    // Best selling products (all time, non-cancelled)
    let topSellingProducts: { id: string; name: string; quantity: number }[] = []
    if (productIds.length > 0) {
      const salesGroups = await prisma.orderItem.groupBy({
        by: ['productId'],
        where: { productId: { in: productIds } },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      })
      topSellingProducts = salesGroups
        .filter((s) => s._sum.quantity != null)
        .map((s) => ({
          id: s.productId,
          name: productMap[s.productId] ?? '',
          quantity: s._sum.quantity!,
        }))
    }

    res.json({ views14days, topViewedProducts, topSellingProducts })
  } catch (err) {
    next(err)
  }
}

export const getMyFarm = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const baseFarm = await getMyFarmByUser(req.user.id)
    if (!baseFarm) return res.status(404).json({ message: 'Farm not found' })
    const farm = await prisma.farm.findUnique({
      where: { id: baseFarm.id },
      include: { products: { include: { category: true, reviews: { select: { rating: true } }, _count: { select: { reviews: true } } } } },
    })
    if (!farm) return res.status(404).json({ message: 'Farm not found' })
    const pricing = await getActivePricingConfig()
    res.json({ ...farm, products: injectDisplayPrice(farm.products, pricing) })
  } catch (err) {
    next(err)
  }
}

export const updateFarm = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description, location, province, district, subdistrict, zipCode, image, images, videos } = req.body
    const existing = await prisma.farm.findUnique({ where: { userId: req.user.id } })
    if (!existing) return res.status(404).json({ message: 'Farm not found' })
    const slug = name && name !== existing.name
      ? await generateUniqueSlug(name, existing.id)
      : (existing.slug ?? await generateUniqueSlug(existing.name, existing.id))
    const farm = await prisma.farm.update({
      where: { userId: req.user.id },
      data: {
        slug, name, description, location, province, district, subdistrict, zipCode, image,
        images: Array.isArray(images) ? images : undefined,
        videos: Array.isArray(videos) ? videos : undefined,
      },
    })
    res.json(farm)
  } catch (err) {
    next(err)
  }
}

export const getCanReview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const farmId = await resolveFarmId(req.params['id'] as string)
    if (!farmId) return res.status(404).json({ message: 'Farm not found' })
    const userId = req.user.id

    const [hasDeliveredOrder, existingReview] = await Promise.all([
      prisma.order.findFirst({
        where: {
          userId,
          status: 'DELIVERED',
          items: { some: { product: { farmId } } },
        },
      }),
      prisma.farmReview.findUnique({ where: { userId_farmId: { userId, farmId } } }),
    ])

    res.json({ canReview: !!hasDeliveredOrder, hasReviewed: !!existingReview, existingReview })
  } catch (err) {
    next(err)
  }
}

export const createFarmReview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const farmId = await resolveFarmId(req.params['id'] as string)
    if (!farmId) return res.status(404).json({ message: 'Farm not found' })
    const { rating, comment } = req.body
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ message: 'Rating must be 1-5' })

    // Only buyers with a delivered order from this farm can review
    const hasDeliveredOrder = await prisma.order.findFirst({
      where: {
        userId: req.user.id,
        status: 'DELIVERED',
        items: { some: { product: { farmId } } },
      },
    })
    if (!hasDeliveredOrder) return res.status(403).json({ message: 'ต้องเคยสั่งซื้อสินค้าจากฟาร์มนี้และได้รับสินค้าแล้วเท่านั้น' })

    const farm = await prisma.farm.findUnique({ where: { id: farmId } })
    if (!farm) return res.status(404).json({ message: 'Farm not found' })

    const review = await prisma.farmReview.upsert({
      where: { userId_farmId: { userId: req.user.id, farmId } },
      update: { rating, comment },
      create: { userId: req.user.id, farmId, rating, comment },
      include: { user: { select: { name: true, avatar: true } } },
    })
    notify(farm.userId, 'FARM_REVIEW', 'มีรีวิวฟาร์มใหม่', `${review.user.name} ให้คะแนน ${rating} ดาว${comment ? `: "${comment.slice(0, 40)}"` : ''}`, `/farms/${farm.slug ?? farm.id}#reviews`)
    res.json(review)
  } catch (err) {
    next(err)
  }
}

export const getFarmReviews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const farmId = await resolveFarmId(req.params['id'] as string)
    if (!farmId) return res.status(404).json({ message: 'Farm not found' })
    const reviews = await prisma.farmReview.findMany({
      where: { farmId },
      include: { user: { select: { name: true, avatar: true } } },
      orderBy: { createdAt: 'desc' },
    })
    const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0
    res.json({ reviews, avg: Math.round(avg * 10) / 10, total: reviews.length })
  } catch (err) {
    next(err)
  }
}

export const toggleFarmLike = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const farmId = await resolveFarmId(req.params['id'] as string)
    if (!farmId) return res.status(404).json({ message: 'Farm not found' })
    const userId = req.user.id
    const existing = await prisma.farmLike.findUnique({ where: { userId_farmId: { userId, farmId } } })
    if (existing) {
      await prisma.farmLike.delete({ where: { userId_farmId: { userId, farmId } } })
      res.json({ liked: false })
    } else {
      await prisma.farmLike.create({ data: { userId, farmId } })
      res.json({ liked: true })
    }
  } catch (err) {
    next(err)
  }
}

export const getFarmLikeStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const farmId = await resolveFarmId(req.params['id'] as string)
    if (!farmId) return res.status(404).json({ message: 'Farm not found' })
    const userId = (req as { user?: { id: string } }).user?.id
    const [count, liked] = await Promise.all([
      prisma.farmLike.count({ where: { farmId } }),
      userId ? prisma.farmLike.findUnique({ where: { userId_farmId: { userId, farmId } } }) : null,
    ])
    res.json({ count, liked: !!liked })
  } catch (err) {
    next(err)
  }
}

export const resubmitFarm = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const message = req.body?.message
    const farm = await prisma.farm.update({
      where: { userId: req.user.id },
      data: { isVerified: false, isSuspended: false, rejectReason: null },
    })
    await prisma.farmApprovalLog.create({
      data: { farmId: farm.id, actorId: req.user.id, action: 'SUBMITTED', note: message?.trim() || 'ยื่นขออนุมัติใหม่' },
    })
    notifyAllAdmins('FARM_SUBMITTED', 'ฟาร์มยื่นขออนุมัติใหม่', `ฟาร์ม "${farm.name}" ยื่นขออนุมัติซ้ำ`, `/admin/farms`)
    res.json(farm)
  } catch (err) {
    next(err)
  }
}

export const getMyFarmSummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const farm = await getMyFarmByUser(req.user.id)
    if (!farm) return res.status(404).json({ message: 'Farm not found' })

    const period = (req.query.period as string) || 'week'
    const now = new Date()
    const from = new Date(now)
    if (period === 'day') {
      from.setHours(0, 0, 0, 0)
    } else if (period === 'week') {
      const day = from.getDay()
      from.setDate(from.getDate() - (day === 0 ? 6 : day - 1))
      from.setHours(0, 0, 0, 0)
    } else if (period === 'month') {
      from.setDate(1)
      from.setHours(0, 0, 0, 0)
    } else {
      from.setMonth(0, 1)
      from.setHours(0, 0, 0, 0)
    }

    const periodMs = now.getTime() - from.getTime()
    const prevFrom = new Date(from.getTime() - periodMs)

    const [curr, prev] = await Promise.all([
      prisma.$queryRaw(Prisma.sql`
        SELECT
          COUNT(DISTINCT o.id)::bigint               AS "totalOrders",
          COALESCE(SUM(oi.price * oi.quantity), 0)::bigint AS "totalRevenue"
        FROM products p
        JOIN order_items oi ON oi."productId" = p.id
        JOIN orders o       ON o.id = oi."orderId"
        JOIN payments py    ON py."orderId" = o.id AND py.status = 'SUCCESS'
        WHERE p."farmId"::text = ${farm.id}
          AND o."createdAt" >= ${from}
      `),
      prisma.$queryRaw(Prisma.sql`
        SELECT
          COUNT(DISTINCT o.id)::bigint               AS "totalOrders",
          COALESCE(SUM(oi.price * oi.quantity), 0)::bigint AS "totalRevenue"
        FROM products p
        JOIN order_items oi ON oi."productId" = p.id
        JOIN orders o       ON o.id = oi."orderId"
        JOIN payments py    ON py."orderId" = o.id AND py.status = 'SUCCESS'
        WHERE p."farmId"::text = ${farm.id}
          AND o."createdAt" >= ${prevFrom}
          AND o."createdAt" <  ${from}
      `),
    ])

    const c = (curr as { totalOrders: bigint; totalRevenue: bigint }[])[0]
    const p = (prev as { totalOrders: bigint; totalRevenue: bigint }[])[0]
    const totalOrders = Number(c?.totalOrders ?? 0)
    const totalRevenue = Number(c?.totalRevenue ?? 0)
    const prevOrders = Number(p?.totalOrders ?? 0)
    const prevRevenue = Number(p?.totalRevenue ?? 0)

    res.json({
      totalOrders, totalRevenue,
      orderGrowth: prevOrders === 0 ? null : Math.round(((totalOrders - prevOrders) / prevOrders) * 100),
      revenueGrowth: prevRevenue === 0 ? null : Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 100),
    })
  } catch (err) {
    next(err)
  }
}

export const updateShippingRate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { shippingRate, shippingWeightLimitKg, shippingPerKgRate, shippingFreeThreshold } = req.body
    const config = await getActiveShippingConfig()

    const rate = (shippingRate === null || shippingRate === undefined)
      ? null
      : Math.max(config.minBaseRate, Math.min(config.maxBaseRate, Number(shippingRate)))

    const weightLimit = (shippingWeightLimitKg === null || shippingWeightLimitKg === undefined)
      ? null : Math.max(0, Number(shippingWeightLimitKg))

    const perKg = (shippingPerKgRate === null || shippingPerKgRate === undefined)
      ? null : Math.max(0, Number(shippingPerKgRate))

    const freeThresh = (shippingFreeThreshold === null || shippingFreeThreshold === undefined)
      ? null : Math.max(0, Number(shippingFreeThreshold))

    const baseFarm = await getMyFarmByUser(req.user.id)
    if (!baseFarm) return res.status(404).json({ message: 'Farm not found' })
    const farm = await prisma.farm.update({
      where: { id: baseFarm.id },
      data: {
        shippingRate: rate,
        shippingWeightLimitKg: weightLimit,
        shippingPerKgRate: perKg,
        shippingFreeThreshold: freeThresh,
      },
      select: { id: true, shippingRate: true, shippingWeightLimitKg: true, shippingPerKgRate: true, shippingFreeThreshold: true },
    })
    res.json(farm)
  } catch (err) {
    next(err)
  }
}

export const getPublicShippingConfig = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await getActiveShippingConfig()
    res.json(config)
  } catch (err) {
    next(err)
  }
}

export const getMyFarmAdmins = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const farm = await getMyFarmByUser(req.user.id)
    if (!farm) return res.status(404).json({ message: 'Farm not found' })
    // Only the farm owner can manage admins
    if (farm.userId !== req.user.id) return res.status(403).json({ message: 'Only the farm owner can manage admins' })
    const admins = await prisma.farmAdmin.findMany({
      where: { farmId: farm.id },
      include: { user: { select: { id: true, name: true, email: true, avatar: true, role: true } } },
      orderBy: { createdAt: 'asc' },
    })
    res.json(admins)
  } catch (err) {
    next(err)
  }
}

export const addMyFarmAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const farm = await getMyFarmByUser(req.user.id)
    if (!farm) return res.status(404).json({ message: 'Farm not found' })
    if (farm.userId !== req.user.id) return res.status(403).json({ message: 'Only the farm owner can manage admins' })

    const { userId } = req.body
    if (!userId) return res.status(400).json({ message: 'userId is required' })
    if (userId === req.user.id) return res.status(400).json({ message: 'Cannot add yourself as admin' })

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return res.status(404).json({ message: 'User not found' })

    const existing = await prisma.farmAdmin.findUnique({ where: { farmId_userId: { farmId: farm.id, userId } } })
    if (existing) return res.status(400).json({ message: 'User is already an admin of this farm' })

    const admin = await prisma.farmAdmin.create({
      data: { farmId: farm.id, userId, invitedBy: req.user.id, status: 'PENDING' },
      include: { user: { select: { id: true, name: true, email: true, avatar: true, role: true } } },
    })
    res.status(201).json(admin)
  } catch (err) {
    next(err)
  }
}

export const removeMyFarmAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const farm = await getMyFarmByUser(req.user.id)
    if (!farm) return res.status(404).json({ message: 'Farm not found' })
    if (farm.userId !== req.user.id) return res.status(403).json({ message: 'Only the farm owner can manage admins' })

    const userId = req.params['userId'] as string
    const record = await prisma.farmAdmin.findUnique({ where: { farmId_userId: { farmId: farm.id, userId } } })
    if (!record) return res.status(404).json({ message: 'Admin not found' })

    await prisma.farmAdmin.delete({ where: { farmId_userId: { farmId: farm.id, userId } } })
    res.json({ message: 'Admin removed' })
  } catch (err) {
    next(err)
  }
}

export const searchUsersForFarm = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const farm = await getMyFarmByUser(req.user.id)
    if (!farm) return res.status(404).json({ message: 'Farm not found' })
    if (farm.userId !== req.user.id) return res.status(403).json({ message: 'Only the farm owner can manage admins' })

    const q = (req.query.q as string)?.trim()
    if (!q || q.length < 2) return res.json([])

    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        id: { not: req.user.id },
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true, email: true, avatar: true, role: true },
      take: 10,
    })
    res.json(users)
  } catch (err) {
    next(err)
  }
}

// Get pending invitations for the current user
export const getMyInvitations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const invitations = await prisma.farmAdmin.findMany({
      where: { userId: req.user.id, status: 'PENDING' },
      include: {
        farm: { select: { id: true, name: true, image: true, province: true } },
        inviter: { select: { id: true, name: true, avatar: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json(invitations)
  } catch (err) {
    next(err)
  }
}

// Accept an invitation
export const acceptInvitation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const record = await prisma.farmAdmin.findFirst({ where: { id: id as string, userId: req.user.id, status: 'PENDING' } })
    if (!record) return res.status(404).json({ message: 'Invitation not found' })
    const updated = await prisma.farmAdmin.update({
      where: { id: id as string },
      data: { status: 'ACCEPTED' },
      include: { farm: { select: { id: true, name: true, image: true, province: true, userId: true } } },
    })
    notify(updated.farm.userId, 'FARM_ADMIN_ACCEPTED', 'ผู้ใช้ตอบรับคำเชิญ', `มีผู้ดูแลเพิ่มเติมในฟาร์ม "${updated.farm.name}" แล้ว`, `/seller/admins`)
    res.json(updated)
  } catch (err) {
    next(err)
  }
}

// Decline an invitation
export const declineInvitation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const record = await prisma.farmAdmin.findFirst({ where: { id: id as string, userId: req.user.id, status: 'PENDING' } })
    if (!record) return res.status(404).json({ message: 'Invitation not found' })
    await prisma.farmAdmin.delete({ where: { id: id as string } })
    res.json({ message: 'Invitation declined' })
  } catch (err) {
    next(err)
  }
}

// Get all farms where current user is an ACCEPTED admin (for navbar/profile)
export const getMyFarmMemberships = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const memberships = await prisma.farmAdmin.findMany({
      where: { userId: req.user.id, status: 'ACCEPTED' },
      include: { farm: { select: { id: true, name: true, image: true, province: true } } },
      orderBy: { createdAt: 'asc' },
    })
    res.json(memberships)
  } catch (err) {
    next(err)
  }
}

export const getFarmApprovalLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const logs = await prisma.farmApprovalLog.findMany({
      where: { farmId: req.params['id'] as string },
      include: { actor: { select: { name: true, role: true } } },
      orderBy: { createdAt: 'desc' },
    })
    res.json(logs)
  } catch (err) {
    next(err)
  }
}
