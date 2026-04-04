import { Request, Response, NextFunction } from 'express'
import prisma from '../config/database'

export const getCategories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      include: { _count: { select: { products: true } } },
    })
    res.json(categories)
  } catch (err) {
    next(err)
  }
}

export const createCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, image } = req.body
    const category = await prisma.category.create({ data: { name, image } })
    res.status(201).json(category)
  } catch (err) {
    next(err)
  }
}

export const updateCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, image, isActive } = req.body
    const category = await prisma.category.update({
      where: { id: req.params['id'] as string },
      data: { name, image, isActive },
    })
    res.json(category)
  } catch (err) {
    next(err)
  }
}
