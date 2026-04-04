import { Request, Response, NextFunction } from 'express'
import prisma from '../config/database'
import { getActivePricingConfig, calcDisplayPrice } from '../utils/pricing'

const cartInclude = {
  items: {
    include: {
      product: {
        include: { farm: { select: { id: true, name: true, shippingRate: true, shippingWeightLimitKg: true, shippingPerKgRate: true, shippingFreeThreshold: true } } },
      },
    },
  },
} as const

function applyPricingToCart(cart: any, pricing: any) {
  return {
    ...cart,
    items: cart.items.map((item: any) => ({
      ...item,
      product: {
        ...item.product,
        displayPrice: calcDisplayPrice(Number(item.product.price), pricing),
      },
    })),
  }
}

export const getCart = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [cart, pricing] = await Promise.all([
      prisma.cart.upsert({
        where: { userId: req.user.id },
        create: { userId: req.user.id },
        update: {},
        include: cartInclude,
      }),
      getActivePricingConfig(),
    ])
    res.json(applyPricingToCart(cart, pricing))
  } catch (err) {
    next(err)
  }
}

export const addToCart = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { productId, quantity } = req.body
    const product = await prisma.product.findUnique({ where: { id: productId } })
    if (!product || !product.isActive) return res.status(404).json({ message: 'Product not found' })
    if (product.stock < quantity) return res.status(400).json({ message: 'Insufficient stock' })

    // SELLER cannot add their own farm's products to cart
    if (req.user.role === 'SELLER') {
      const myFarm = await prisma.farm.findUnique({ where: { userId: req.user.id }, select: { id: true } })
      if (myFarm?.id === product.farmId) return res.status(403).json({ message: 'ไม่สามารถสั่งซื้อสินค้าของฟาร์มตัวเองได้' })
    }

    const cart = await prisma.cart.upsert({
      where: { userId: req.user.id },
      create: { userId: req.user.id },
      update: {},
    })

    const existingItem = await prisma.cartItem.findUnique({ where: { cartId_productId: { cartId: cart.id, productId } } })
    if (existingItem) {
      await prisma.cartItem.update({ where: { id: existingItem.id }, data: { quantity: existingItem.quantity + quantity } })
    } else {
      await prisma.cartItem.create({ data: { cartId: cart.id, productId, quantity } })
    }

    const [updated, pricing] = await Promise.all([
      prisma.cart.findUnique({ where: { id: cart.id }, include: cartInclude }),
      getActivePricingConfig(),
    ])
    res.json(applyPricingToCart(updated, pricing))
  } catch (err) {
    next(err)
  }
}

export const updateCartItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { quantity } = req.body
    const itemId = req.params['itemId'] as string
    const cart = await prisma.cart.findUnique({ where: { userId: req.user.id } })
    if (!cart) return res.status(404).json({ message: 'Cart not found' })

    if (quantity <= 0) {
      await prisma.cartItem.delete({ where: { id: itemId, cartId: cart.id } })
    } else {
      await prisma.cartItem.update({ where: { id: itemId, cartId: cart.id }, data: { quantity } })
    }
    const [updated, pricing] = await Promise.all([
      prisma.cart.findUnique({ where: { id: cart.id }, include: cartInclude }),
      getActivePricingConfig(),
    ])
    res.json(applyPricingToCart(updated, pricing))
  } catch (err) {
    next(err)
  }
}

export const removeCartItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const itemId = req.params['itemId'] as string
    const cart = await prisma.cart.findUnique({ where: { userId: req.user.id } })
    await prisma.cartItem.delete({ where: { id: itemId, cartId: cart!.id } })
    res.json({ message: 'Item removed' })
  } catch (err) {
    next(err)
  }
}

export const clearCart = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cart = await prisma.cart.findUnique({ where: { userId: req.user.id } })
    if (cart) await prisma.cartItem.deleteMany({ where: { cartId: cart.id } })
    res.json({ message: 'Cart cleared' })
  } catch (err) {
    next(err)
  }
}
