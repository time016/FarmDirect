import { Request, Response, NextFunction } from 'express'
import { OrderStatus } from '@prisma/client'
import prisma from '../config/database'
import { getActivePricingConfig, calcDisplayPrice } from '../utils/pricing'
import { getActiveShippingConfig, calcShipping } from '../utils/shipping'
import { getMyFarmByUser } from './farm.controller'
import { notify } from '../utils/notification'

export const createOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { addressId, note } = req.body

    const cart = await prisma.cart.findUnique({
      where: { userId: req.user.id },
      include: { items: { include: { product: true } } },
    })
    if (!cart || cart.items.length === 0) return res.status(400).json({ message: 'Cart is empty' })

    const address = await prisma.address.findUnique({ where: { id: addressId as string, userId: req.user.id } })
    if (!address) return res.status(404).json({ message: 'Address not found' })

    for (const item of cart.items) {
      const available = item.product.stock - item.product.reservedStock
      if (available < item.quantity) {
        return res.status(400).json({ message: `สินค้า "${item.product.name}" มีไม่เพียงพอ (คงเหลือ ${available})` })
      }
    }

    const [pricing, shippingConfig] = await Promise.all([
      getActivePricingConfig(),
      getActiveShippingConfig(),
    ])

    // แยกกลุ่มสินค้าต่อฟาร์ม
    const farmIds = [...new Set(cart.items.map((i) => i.product.farmId))]
    const farms = await prisma.farm.findMany({
      where: { id: { in: farmIds } },
      select: { id: true, shippingRate: true, shippingWeightLimitKg: true, shippingPerKgRate: true, shippingFreeThreshold: true },
    })
    const farmOverrideMap = Object.fromEntries(farms.map((f) => [f.id, {
      shippingRate: f.shippingRate,
      shippingWeightLimitKg: f.shippingWeightLimitKg,
      shippingPerKgRate: f.shippingPerKgRate,
      shippingFreeThreshold: f.shippingFreeThreshold,
    }]))

    const farmGroups = farmIds.map((farmId) => {
      const items = cart.items.filter((i) => i.product.farmId === farmId)
      const itemsWithPrice = items.map((item) => ({
        ...item,
        displayPrice: calcDisplayPrice(Number(item.product.price), pricing),
      }))
      const subtotal = itemsWithPrice.reduce((s, i) => s + i.displayPrice * i.quantity, 0)
      const shippingItems = items.map((item) => ({
        quantity: item.quantity,
        product: { unit: item.product.unit, weightKg: item.product.weightKg },
      }))
      const { shippingFee } = calcShipping(shippingItems, subtotal, shippingConfig, farmOverrideMap[farmId] ?? null)
      return { farmId, items, itemsWithPrice, subtotal, shippingFee }
    })

    // สร้าง order แยกต่อฟาร์ม ใน transaction เดียว
    const orders = await prisma.$transaction(async (tx) => {
      const created = []
      for (const group of farmGroups) {
        const newOrder = await tx.order.create({
          data: {
            userId: req.user.id,
            addressId,
            note,
            totalAmount: group.subtotal + group.shippingFee,
            shippingFee: group.shippingFee,
            items: {
              create: group.itemsWithPrice.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                price: item.displayPrice,
              })),
            },
          },
          include: { items: { include: { product: true } }, address: true },
        })
        created.push(newOrder)
        // จอง stock
        for (const item of group.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { reservedStock: { increment: item.quantity } },
          })
        }
      }
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } })
      return created
    })

    // แจ้ง seller ของแต่ละฟาร์ม
    for (const order of orders) {
      const farmId = order.items[0]?.product?.farmId
      if (farmId) {
        const farm = await prisma.farm.findUnique({ where: { id: farmId }, select: { userId: true, name: true } })
        if (farm) {
          notify(farm.userId, 'ORDER_PLACED', 'มีคำสั่งซื้อใหม่', `ออเดอร์ #${order.id.slice(0, 8).toUpperCase()} — ฿${Number(order.totalAmount).toLocaleString()}`, `/seller/orders`)
        }
      }
    }

    res.status(201).json({ orders })
  } catch (err) {
    next(err)
  }
}

export const getMyOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = req.query.status as OrderStatus | undefined
    const page = Number(req.query.page) || 1
    const limit = Number(req.query.limit) || 10
    const where = { userId: req.user.id, ...(status && { status }) }
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: { items: { include: { product: { select: { id: true, name: true, images: true, farm: { select: { id: true, name: true } } } } } }, payment: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where }),
    ])
    res.json({ orders, total, page, totalPages: Math.ceil(total / limit) })
  } catch (err) {
    next(err)
  }
}

export const getOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params['id'] as string
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: { product: { include: { farm: { select: { id: true, name: true } } } } } },
        address: true,
        payment: true,
        user: { select: { name: true, email: true, phone: true } },
      },
    })
    if (!order) return res.status(404).json({ message: 'Order not found' })
    if (order.userId !== req.user.id && req.user.role === 'BUYER') {
      return res.status(403).json({ message: 'Forbidden' })
    }
    res.json(order)
  } catch (err) {
    next(err)
  }
}

export const getSellerOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const farm = await getMyFarmByUser(req.user.id)
    if (!farm) return res.status(404).json({ message: 'Farm not found' })

    const status = req.query.status as OrderStatus | undefined
    const page = Number(req.query.page) || 1
    const limit = Number(req.query.limit) || 10
    const where = {
      items: { some: { product: { farmId: farm.id } } },
      ...(status && { status }),
    }
    const baseWhere = { items: { some: { product: { farmId: farm.id } } } }
    const [orders, total, statusGroups] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: { where: { product: { farmId: farm.id } }, include: { product: true } },
          address: true,
          user: { select: { name: true, phone: true } },
          payment: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where }),
      prisma.order.groupBy({ by: ['status'], where: baseWhere, _count: { id: true } }),
    ])
    const totalAll = statusGroups.reduce((s, g) => s + g._count.id, 0)
    const statusCounts: Record<string, number> = { '': totalAll }
    for (const g of statusGroups) statusCounts[g.status] = g._count.id
    res.json({ orders, total, page, totalPages: Math.ceil(total / limit), statusCounts })
  } catch (err) {
    next(err)
  }
}

export const cancelOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params['id'] as string
    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: true },
    })
    if (!order) return res.status(404).json({ message: 'Order not found' })
    if (order.userId !== req.user.id) return res.status(403).json({ message: 'Forbidden' })
    if (order.status !== 'PENDING') return res.status(400).json({ message: 'สามารถยกเลิกได้เฉพาะคำสั่งซื้อที่รอชำระเงินเท่านั้น' })

    const { cancelNote } = req.body

    await prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id }, data: { status: 'CANCELLED', cancelNote: cancelNote || null } })
      // คืน reserved stock
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { reservedStock: { decrement: item.quantity } },
        })
      }
    })

    // แจ้ง seller
    const farmId = order.items[0]?.productId
      ? (await prisma.orderItem.findFirst({ where: { orderId: id }, include: { product: { select: { farmId: true } } } }))?.product.farmId
      : null
    if (farmId) {
      const farm = await prisma.farm.findUnique({ where: { id: farmId }, select: { userId: true } })
      if (farm) notify(farm.userId, 'ORDER_CANCELLED', 'ผู้ซื้อยกเลิกออเดอร์', `ออเดอร์ #${id.slice(0, 8).toUpperCase()} ถูกยกเลิกโดยผู้ซื้อ`, `/seller/orders`)
    }

    res.json({ message: 'ยกเลิกคำสั่งซื้อแล้ว' })
  } catch (err) {
    next(err)
  }
}

export const confirmDelivery = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params['id'] as string
    const order = await prisma.order.findUnique({ where: { id }, include: { items: true } })
    if (!order) return res.status(404).json({ message: 'Order not found' })
    if (order.userId !== req.user.id) return res.status(403).json({ message: 'Forbidden' })
    if (order.status !== 'SHIPPING') return res.status(400).json({ message: 'สามารถยืนยันรับได้เฉพาะคำสั่งซื้อที่กำลังจัดส่งเท่านั้น' })

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.order.update({ where: { id }, data: { status: 'DELIVERED' } })
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: { decrement: item.quantity },
            reservedStock: { decrement: item.quantity },
          },
        })
      }
      return result
    })
    res.json(updated)
  } catch (err) {
    next(err)
  }
}

export const updateOrderStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params['id'] as string
    const { status, cancelNote, trackingNumber } = req.body

    // ตัด stock เมื่อ DELIVERED (seller กดยืนยันจัดส่งถึง)
    if (status === 'DELIVERED') {
      const order = await prisma.order.findUnique({ where: { id }, include: { items: true } })
      if (!order) return res.status(404).json({ message: 'Order not found' })

      const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.order.update({ where: { id }, data: { status } })
        for (const item of order.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: { decrement: item.quantity },
              reservedStock: { decrement: item.quantity },
            },
          })
        }
        return updated
      })
      return res.json(result)
    }

    // CANCELLED (seller) — คืน reserved stock
    if (status === 'CANCELLED') {
      const order = await prisma.order.findUnique({ where: { id }, include: { items: true } })
      if (!order) return res.status(404).json({ message: 'Order not found' })

      const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.order.update({
          where: { id },
          data: { status, cancelNote: cancelNote || null },
        })
        for (const item of order.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { reservedStock: { decrement: item.quantity } },
          })
        }
        return updated
      })
      return res.json(result)
    }

    const updated = await prisma.order.update({
      where: { id },
      data: {
        status,
        ...(status === 'SHIPPING' && { trackingNumber: trackingNumber?.trim() || null }),
      },
      include: { user: { select: { id: true } } },
    })

    // แจ้ง buyer
    const msgMap: Record<string, { title: string; body: string }> = {
      CONFIRMED:  { title: 'ออเดอร์ได้รับการยืนยัน', body: `ออเดอร์ #${id.slice(0, 8).toUpperCase()} ได้รับการยืนยันแล้ว` },
      SHIPPING:   { title: 'ออเดอร์กำลังจัดส่ง', body: `ออเดอร์ #${id.slice(0, 8).toUpperCase()} กำลังจัดส่ง${trackingNumber ? ` · เลขพัสดุ ${trackingNumber}` : ''}` },
      DELIVERED:  { title: 'จัดส่งสำเร็จ', body: `ออเดอร์ #${id.slice(0, 8).toUpperCase()} จัดส่งถึงแล้ว` },
      CANCELLED:  { title: 'ออเดอร์ถูกยกเลิก', body: `ออเดอร์ #${id.slice(0, 8).toUpperCase()} ถูกยกเลิกโดยผู้ขาย${cancelNote ? ` (${cancelNote})` : ''}` },
    }
    const msg = msgMap[status]
    if (msg && updated.user) {
      notify(updated.user.id, `ORDER_${status}`, msg.title, msg.body, `/orders/${id}`)
    }

    res.json(updated)
  } catch (err) {
    next(err)
  }
}
