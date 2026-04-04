import { Request, Response, NextFunction } from 'express'
import prisma from '../config/database'

export const getProductReviews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const productId = req.params['productId'] as string
    const page = Number(req.query.page) || 1
    const limit = Number(req.query.limit) || 10
    const where = { productId }
    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        include: { user: { select: { name: true, avatar: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.review.count({ where }),
    ])
    const avgRating = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0
    res.json({ reviews, total, avgRating: Math.round(avgRating * 10) / 10 })
  } catch (err) {
    next(err)
  }
}

export const createReview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { productId, rating, comment, images } = req.body
    if (rating < 1 || rating > 5) return res.status(400).json({ message: 'Rating must be 1-5' })

    const hasPurchased = await prisma.orderItem.findFirst({
      where: { productId, order: { userId: req.user.id, status: 'DELIVERED' } },
    })
    if (!hasPurchased) return res.status(403).json({ message: 'You can only review purchased products' })

    const existing = await prisma.review.findFirst({ where: { userId: req.user.id, productId } })
    if (existing) return res.status(400).json({ message: 'You have already reviewed this product' })

    const review = await prisma.review.create({
      data: { userId: req.user.id, productId, rating, comment, images: images || [], quantity: hasPurchased.quantity },
      include: { user: { select: { name: true, avatar: true } } },
    })
    res.status(201).json(review)
  } catch (err) {
    next(err)
  }
}
