import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import prisma from '../config/database'
import { JwtPayload } from '../types'

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ message: 'No token provided' })

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload
    const user = await prisma.user.findUnique({ where: { id: decoded.id } })
    if (!user || !user.isActive) return res.status(401).json({ message: 'Unauthorized' })
    req.user = user
    next()
  } catch {
    res.status(401).json({ message: 'Invalid token' })
  }
}

export const authorizeRoles = (...roles: string[]) => (req: Request, res: Response, next: NextFunction) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Forbidden' })
  }
  next()
}

// Allows SELLER, ADMIN, HOST (farm owner), OR any user who is a FarmAdmin of any farm
export const authorizeFarmMember = async (req: Request, res: Response, next: NextFunction) => {
  if (req.user.role === 'SELLER' || req.user.role === 'ADMIN' || req.user.role === 'HOST') return next()
  const farmAdmin = await prisma.farmAdmin.findFirst({ where: { userId: req.user.id, status: 'ACCEPTED' } })
  if (farmAdmin) return next()
  return res.status(403).json({ message: 'Forbidden' })
}
