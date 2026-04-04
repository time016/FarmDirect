import { Request, Response, NextFunction } from 'express'
import prisma from '../config/database'
import { getActivePricingConfig, calcDisplayPrice } from '../utils/pricing'
import { getMyFarmByUser } from './farm.controller'

export const getProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const categoryIdRaw = req.query.categoryId as string | undefined
    const categoryIds = categoryIdRaw ? categoryIdRaw.split(',').filter(Boolean) : []
    const farmId = req.query.farmId as string | undefined
    const search = req.query.search as string | undefined
    const minPrice = req.query.minPrice as string | undefined
    const maxPrice = req.query.maxPrice as string | undefined
    const page = Number(req.query.page) || 1
    const limit = Number(req.query.limit) || 12
    const sortBy = req.query.sortBy as string | undefined
    const where = {
      isActive: true,
      ...(categoryIds.length === 1 && { categoryId: categoryIds[0] }),
      ...(categoryIds.length > 1 && { categoryId: { in: categoryIds } }),
      ...(farmId && { farmId }),
      ...(search && { name: { contains: search, mode: 'insensitive' as const } }),
      ...((minPrice || maxPrice) && {
        price: {
          ...(minPrice && { gte: Number(minPrice) }),
          ...(maxPrice && { lte: Number(maxPrice) }),
        },
      }),
    }

    const include = {
      farm: { select: { id: true, name: true, province: true } },
      category: { select: { id: true, name: true } },
      reviews: { select: { rating: true } },
      _count: { select: { reviews: true } },
    }

    let products: any[]
    let total: number
    let pricing: any

    if (sortBy === 'bestseller') {
      // Get bestseller product IDs sorted by total quantity sold
      const salesRanking = await prisma.orderItem.groupBy({
        by: ['productId'],
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
      })
      const rankedIds = salesRanking.map((s) => s.productId)
      ;[products, total, pricing] = await Promise.all([
        prisma.product.findMany({ where, include, take: limit * 5 }),
        prisma.product.count({ where }),
        getActivePricingConfig(),
      ])
      const rankMap = new Map(rankedIds.map((id, i) => [id, i]))
      products = products
        .sort((a, b) => (rankMap.get(a.id) ?? Infinity) - (rankMap.get(b.id) ?? Infinity))
        .slice((page - 1) * limit, page * limit)
    } else {
      ;[products, total, pricing] = await Promise.all([
        prisma.product.findMany({
          where,
          include,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.product.count({ where }),
        getActivePricingConfig(),
      ])
    }

    const productsWithPrice = products.map((p) => ({
      ...p,
      displayPrice: calcDisplayPrice(Number(p.price), pricing),
    }))
    res.json({ products: productsWithPrice, total, page, totalPages: Math.ceil(total / limit) })
  } catch (err) {
    next(err)
  }
}

export const getProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params['id'] as string
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        farm: { select: { id: true, name: true, location: true, province: true } },
        category: true,
        reviews: {
          include: { user: { select: { name: true, avatar: true } } },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    })
    if (!product) return res.status(404).json({ message: 'Product not found' })

    // Track product view (fire-and-forget)
    prisma.productView.create({ data: { productId: product.id } }).catch(() => {})

    const pricing = await getActivePricingConfig()
    res.json({ ...product, displayPrice: calcDisplayPrice(Number(product.price), pricing) })
  } catch (err) {
    next(err)
  }
}

export const createProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const farm = await getMyFarmByUser(req.user.id)
    if (!farm) return res.status(404).json({ message: 'Please create a farm first' })

    const { name, description, price, unit, stock, categoryId, images, videos } = req.body
    const product = await prisma.product.create({
      data: { farmId: farm.id, name, description, price, unit, stock, categoryId, images: images || [], videos: videos || [] },
    })
    res.status(201).json(product)
  } catch (err) {
    next(err)
  }
}

export const updateProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params['id'] as string
    const farm = await getMyFarmByUser(req.user.id)
    if (!farm) return res.status(404).json({ message: 'Farm not found' })

    const product = await prisma.product.findFirst({ where: { id, farmId: farm.id } })
    if (!product) return res.status(404).json({ message: 'Product not found' })

    const { name, description, price, unit, stock, categoryId, images, videos, isActive } = req.body
    const updated = await prisma.product.update({
      where: { id },
      data: { name, description, price, unit, stock, categoryId, images, videos, isActive },
    })
    res.json(updated)
  } catch (err) {
    next(err)
  }
}

export const getPublicPricingConfig = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await getActivePricingConfig()
    res.json({
      pricingModel: config.pricingModel,
      commissionRate: config.commissionRate,
      vatEnabled: config.vatEnabled,
      vatRate: config.vatRate,
    })
  } catch (err) {
    next(err)
  }
}

export const deleteProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params['id'] as string
    const farm = await getMyFarmByUser(req.user.id)
    const product = await prisma.product.findFirst({ where: { id, farmId: farm?.id } })
    if (!product) return res.status(404).json({ message: 'Product not found' })

    await prisma.product.update({ where: { id }, data: { isActive: false } })
    res.json({ message: 'Product deactivated' })
  } catch (err) {
    next(err)
  }
}
