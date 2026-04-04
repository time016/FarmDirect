import { Request, Response, NextFunction } from 'express'
import prisma from '../config/database'

export const getNotifications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Number(req.query.page) || 1
    const limit = Number(req.query.limit) || 20
    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({ where: { userId: req.user.id } }),
      prisma.notification.count({ where: { userId: req.user.id, isRead: false } }),
    ])
    res.json({ notifications, total, page, totalPages: Math.ceil(total / limit), unreadCount })
  } catch (err) {
    next(err)
  }
}

export const getUnreadCount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const count = await prisma.notification.count({ where: { userId: req.user.id, isRead: false } })
    res.json({ count })
  } catch (err) {
    next(err)
  }
}

export const markRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    await prisma.notification.updateMany({ where: { id: id as string, userId: req.user.id }, data: { isRead: true } })
    res.json({ message: 'ok' })
  } catch (err) {
    next(err)
  }
}

export const markAllRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.notification.updateMany({ where: { userId: req.user.id, isRead: false }, data: { isRead: true } })
    res.json({ message: 'ok' })
  } catch (err) {
    next(err)
  }
}

export const deleteAllNotifications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.notification.deleteMany({ where: { userId: req.user.id } })
    res.json({ message: 'ok' })
  } catch (err) {
    next(err)
  }
}

export const deleteNotification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    await prisma.notification.deleteMany({ where: { id: id as string, userId: req.user.id } })
    res.json({ message: 'ok' })
  } catch (err) {
    next(err)
  }
}
