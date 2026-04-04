import { Request, Response, NextFunction } from 'express'
import { Role, OrderStatus, Prisma } from '@prisma/client'
import prisma from '../config/database'

export const getUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = req.query.role as Role | undefined
    const search = req.query.search as string | undefined
    const page = Number(req.query.page) || 1
    const limit = Number(req.query.limit) || 20
    const where = {
      ...(role && { role }),
      ...(search && { OR: [{ name: { contains: search, mode: 'insensitive' as const } }, { email: { contains: search, mode: 'insensitive' as const } }] }),
    }
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: { id: true, email: true, name: true, phone: true, role: true, isActive: true, createdAt: true },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ])
    res.json({ users, total, page, totalPages: Math.ceil(total / limit) })
  } catch (err) {
    next(err)
  }
}

export const updateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { isActive, role } = req.body
    const user = await prisma.user.update({
      where: { id: req.params['id'] as string },
      data: { isActive, role },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    })
    res.json(user)
  } catch (err) {
    next(err)
  }
}

export const getFarms = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = req.query.status as string | undefined // all | pending | verified | rejected
    const search = req.query.search as string | undefined
    const page = Number(req.query.page) || 1
    const limit = Number(req.query.limit) || 20

    const where: Record<string, unknown> = {}
    if (search) where['name'] = { contains: search, mode: 'insensitive' }
    if (status === 'verified') { where['isVerified'] = true }
    else if (status === 'pending') { where['isVerified'] = false; where['isSuspended'] = false; where['rejectReason'] = null }
    else if (status === 'rejected') { where['isVerified'] = false; where['isSuspended'] = false; where['rejectReason'] = { not: null } }
    else if (status === 'suspended') { where['isSuspended'] = true }

    const [farms, total, statusCounts] = await Promise.all([
      prisma.farm.findMany({
        where,
        include: {
          user: { select: { name: true, email: true, phone: true } },
          _count: { select: { products: true, farmLikes: true, farmReviews: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.farm.count({ where }),
      Promise.all([
        prisma.farm.count(),
        prisma.farm.count({ where: { isVerified: true } }),
        prisma.farm.count({ where: { isVerified: false, isSuspended: false, rejectReason: null } }),
        prisma.farm.count({ where: { isVerified: false, isSuspended: false, rejectReason: { not: null } } }),
        prisma.farm.count({ where: { isSuspended: true } }),
      ]),
    ])

    // Fetch order count + revenue per farm (only orders with successful payment)
    const farmIds = farms.map((f) => f.id)
    type FarmStat = { farmId: string; orderCount: bigint; revenue: bigint }
    const farmStats: FarmStat[] = farmIds.length > 0
      ? await prisma.$queryRaw(Prisma.sql`
          SELECT
            p."farmId",
            COUNT(DISTINCT oi."orderId")::bigint             AS "orderCount",
            COALESCE(SUM(oi.price * oi.quantity), 0)::bigint AS "revenue"
          FROM products p
          LEFT JOIN order_items oi ON oi."productId" = p.id
          LEFT JOIN orders o       ON o.id = oi."orderId"
          LEFT JOIN payments py    ON py."orderId" = o.id AND py.status = 'SUCCESS'
          WHERE p."farmId"::text = ANY(${farmIds})
            AND py.id IS NOT NULL
          GROUP BY p."farmId"
        `)
      : []

    const statsMap = Object.fromEntries(farmStats.map((s) => [s['farmId'], s]))
    const farmsWithStats = farms.map((f) => ({
      ...f,
      orderCount: Number(statsMap[f.id]?.orderCount ?? 0),
      revenue: Number(statsMap[f.id]?.revenue ?? 0),
    }))

    res.json({
      farms: farmsWithStats, total,
      statusCounts: { all: statusCounts[0], verified: statusCounts[1], pending: statusCounts[2], rejected: statusCounts[3], suspended: statusCounts[4] },
    })
  } catch (err) {
    next(err)
  }
}

export const verifyFarm = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { isVerified, reason } = req.body
    const farmId = req.params['id'] as string
    // Determine action before update
    let action: 'APPROVED' | 'REJECTED' | 'REVOKED'
    let isSuspended = false
    if (isVerified) {
      action = 'APPROVED'
    } else if (reason) {
      // Check if current farm is approved (= revoking) or pending (= rejecting)
      const current = await prisma.farm.findUnique({ where: { id: farmId }, select: { isVerified: true } })
      action = current?.isVerified ? 'REVOKED' : 'REJECTED'
      isSuspended = action === 'REVOKED'
    } else {
      action = 'REVOKED'
      isSuspended = true
    }

    const farm = await prisma.farm.update({
      where: { id: farmId },
      data: {
        isVerified,
        isSuspended,
        rejectReason: isVerified ? null : (reason || null),
      },
    })
    await prisma.farmApprovalLog.create({
      data: { farmId, actorId: req.user.id, action, note: reason || null },
    })

    // แจ้งเจ้าของฟาร์ม
    const { notify } = await import('../utils/notification')
    if (action === 'APPROVED') {
      notify(farm.userId, 'FARM_APPROVED', 'ฟาร์มได้รับการอนุมัติแล้ว', `ฟาร์ม "${farm.name}" ผ่านการตรวจสอบแล้ว`, `/seller/farm/edit`)
    } else if (action === 'REJECTED') {
      notify(farm.userId, 'FARM_REJECTED', 'ฟาร์มไม่ผ่านการอนุมัติ', `ฟาร์ม "${farm.name}" ไม่ผ่าน${reason ? `: ${reason}` : ''}`, `/seller/farm/edit`)
    } else if (action === 'REVOKED') {
      notify(farm.userId, 'FARM_REVOKED', 'การอนุมัติฟาร์มถูกเพิกถอน', `ฟาร์ม "${farm.name}" ถูกระงับ${reason ? `: ${reason}` : ''}`, `/seller/farm/edit`)
    }

    res.json(farm)
  } catch (err) {
    next(err)
  }
}

export const getAllOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = req.query.status as OrderStatus | undefined
    const page = Number(req.query.page) || 1
    const limit = Number(req.query.limit) || 20
    const where = { ...(status && { status }) }
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          user: { select: { name: true, email: true } },
          items: { include: { product: { select: { name: true } } } },
          payment: true,
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.order.count({ where }),
    ])
    res.json({ orders, total })
  } catch (err) {
    next(err)
  }
}

export const getFarmsSummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const period = (req.query.period as string) || 'week' // day | week | month | year

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

    const [orderStats, prevOrderStats] = await Promise.all([
      prisma.$queryRaw(Prisma.sql`
        SELECT
          COUNT(DISTINCT o.id)::bigint             AS "totalOrders",
          COALESCE(SUM(py.amount), 0)::bigint       AS "totalRevenue"
        FROM orders o
        JOIN payments py ON py."orderId" = o.id AND py.status = 'SUCCESS'
        WHERE o."createdAt" >= ${from}
      `),
      prisma.$queryRaw(Prisma.sql`
        SELECT
          COUNT(DISTINCT o.id)::bigint             AS "totalOrders",
          COALESCE(SUM(py.amount), 0)::bigint       AS "totalRevenue"
        FROM orders o
        JOIN payments py ON py."orderId" = o.id AND py.status = 'SUCCESS'
        WHERE o."createdAt" >= ${prevFrom}
          AND o."createdAt" <  ${from}
      `),
    ])

    const curr = (orderStats as { totalOrders: bigint; totalRevenue: bigint }[])[0]
    const prev = (prevOrderStats as { totalOrders: bigint; totalRevenue: bigint }[])[0]

    const totalOrders = Number(curr?.totalOrders ?? 0)
    const totalRevenue = Number(curr?.totalRevenue ?? 0)
    const prevOrders = Number(prev?.totalOrders ?? 0)
    const prevRevenue = Number(prev?.totalRevenue ?? 0)

    const orderGrowth = prevOrders === 0 ? null : Math.round(((totalOrders - prevOrders) / prevOrders) * 100)
    const revenueGrowth = prevRevenue === 0 ? null : Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 100)

    res.json({ totalOrders, totalRevenue, orderGrowth, revenueGrowth, period, from })
  } catch (err) {
    next(err)
  }
}

export const getShippingConfig = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await prisma.shippingConfig.upsert({
      where: { id: 'default' },
      create: { id: 'default' },
      update: {},
    })
    res.json(config)
  } catch (err) {
    next(err)
  }
}

export const updateShippingConfig = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { baseRate, weightLimitKg, perKgRate, freeThreshold, minBaseRate, maxBaseRate } = req.body
    const config = await prisma.shippingConfig.upsert({
      where: { id: 'default' },
      create: { id: 'default', baseRate, weightLimitKg, perKgRate, freeThreshold, minBaseRate, maxBaseRate },
      update: { baseRate, weightLimitKg, perKgRate, freeThreshold, minBaseRate, maxBaseRate },
    })
    res.json(config)
  } catch (err) {
    next(err)
  }
}

export const getPricingConfig = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await prisma.pricingConfig.upsert({
      where: { id: 'default' },
      create: { id: 'default' },
      update: {},
    })
    res.json(config)
  } catch (err) {
    next(err)
  }
}

export const updatePricingConfig = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pricingModel, commissionRate, vatEnabled } = req.body
    if (!['A', 'B'].includes(pricingModel)) return res.status(400).json({ message: 'pricingModel ต้องเป็น A หรือ B' })
    const rate = Number(commissionRate)
    if (isNaN(rate) || rate < 0 || rate > 1) return res.status(400).json({ message: 'commissionRate ต้องอยู่ระหว่าง 0-1' })
    const config = await prisma.pricingConfig.upsert({
      where: { id: 'default' },
      create: { id: 'default', pricingModel, commissionRate: rate, vatEnabled: !!vatEnabled },
      update: { pricingModel, commissionRate: rate, vatEnabled: !!vatEnabled },
    })
    res.json(config)
  } catch (err) {
    next(err)
  }
}

export const getDashboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [totalUsers, totalFarms, totalProducts, totalOrders, revenue] = await Promise.all([
      prisma.user.count(),
      prisma.farm.count(),
      prisma.product.count({ where: { isActive: true } }),
      prisma.order.count(),
      prisma.payment.aggregate({ where: { status: 'SUCCESS' }, _sum: { amount: true } }),
    ])
    res.json({ totalUsers, totalFarms, totalProducts, totalOrders, revenue: revenue._sum.amount || 0 })
  } catch (err) {
    next(err)
  }
}

export const getFarmAdmins = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const farmId = req.params['id'] as string
    const admins = await prisma.farmAdmin.findMany({
      where: { farmId },
      include: {
        user: { select: { id: true, name: true, email: true, role: true, avatar: true } },
        inviter: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    })
    res.json(admins)
  } catch (err) { next(err) }
}

export const addFarmAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const farmId = req.params['id'] as string
    const { userId } = req.body
    const [farm, user] = await Promise.all([
      prisma.farm.findUnique({ where: { id: farmId } }),
      prisma.user.findUnique({ where: { id: userId } }),
    ])
    if (!farm) return res.status(404).json({ message: 'Farm not found' })
    if (!user) return res.status(404).json({ message: 'User not found' })
    const existing = await prisma.farmAdmin.findUnique({ where: { farmId_userId: { farmId, userId } } })
    if (existing) return res.status(400).json({ message: 'ผู้ใช้นี้เป็นแอดมินฟาร์มนี้อยู่แล้ว' })
    const admin = await prisma.farmAdmin.create({
      data: { farmId, userId, invitedBy: req.user.id },
      include: {
        user: { select: { id: true, name: true, email: true, role: true, avatar: true } },
        inviter: { select: { id: true, name: true } },
      },
    })
    res.status(201).json(admin)
  } catch (err) { next(err) }
}

export const removeFarmAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const farmId = req.params['id'] as string
    const userId = req.params['userId'] as string
    const existing = await prisma.farmAdmin.findUnique({ where: { farmId_userId: { farmId, userId } } })
    if (!existing) return res.status(404).json({ message: 'ไม่พบแอดมินฟาร์มนี้' })
    await prisma.farmAdmin.delete({ where: { farmId_userId: { farmId, userId } } })
    res.json({ message: 'ลบแอดมินแล้ว' })
  } catch (err) { next(err) }
}

export const searchUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = (req.query['q'] as string | undefined)?.trim()
    if (!q || q.length < 2) return res.json([])
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
        ],
        isActive: true,
      },
      select: { id: true, name: true, email: true, role: true, avatar: true },
      take: 10,
      orderBy: { name: 'asc' },
    })
    res.json(users)
  } catch (err) { next(err) }
}
