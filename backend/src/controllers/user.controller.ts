import { Request, Response, NextFunction } from 'express'
import prisma from '../config/database'

export const getProfile = async (req: Request, res: Response) => {
  const { password: _, ...user } = req.user
  res.json(user)
}

export const updateProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, phone, avatar } = req.body
    if (name !== undefined && (!name || typeof name !== 'string' || name.trim().length === 0 || name.length > 100)) {
      return res.status(400).json({ message: 'ชื่อต้องมีอย่างน้อย 1 ตัวอักษร และไม่เกิน 100 ตัว' })
    }
    if (phone !== undefined && phone !== null && phone !== '' && !/^0[0-9]{8,9}$/.test(phone.replace(/[-\s]/g, ''))) {
      return res.status(400).json({ message: 'รูปแบบเบอร์โทรไม่ถูกต้อง' })
    }
    if (avatar !== undefined && avatar !== null && avatar !== '' && (typeof avatar !== 'string' || avatar.length > 500)) {
      return res.status(400).json({ message: 'URL รูปภาพไม่ถูกต้อง' })
    }
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { name, phone, avatar },
      select: { id: true, email: true, name: true, phone: true, avatar: true, role: true, isActive: true, emailVerified: true, createdAt: true },
    })
    res.json(user)
  } catch (err) {
    next(err)
  }
}

export const becomeSeller = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user.role !== 'BUYER') {
      return res.status(400).json({ message: 'สามารถเปลี่ยนได้เฉพาะบัญชี ผู้ซื้อ เท่านั้น' })
    }
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { role: 'SELLER' },
      select: { id: true, email: true, name: true, phone: true, avatar: true, role: true, isActive: true, emailVerified: true, createdAt: true },
    })
    res.json(user)
  } catch (err) {
    next(err)
  }
}

export const getAddresses = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const addresses = await prisma.address.findMany({ where: { userId: req.user.id } })
    res.json(addresses)
  } catch (err) {
    next(err)
  }
}

export const createAddress = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { label, recipient, phone, address, subdistrict, district, province, zipCode, isDefault } = req.body
    if (isDefault) {
      await prisma.address.updateMany({ where: { userId: req.user.id }, data: { isDefault: false } })
    }
    const newAddress = await prisma.address.create({
      data: { userId: req.user.id, label, recipient, phone, address, subdistrict, district, province, zipCode, isDefault: !!isDefault },
    })
    res.status(201).json(newAddress)
  } catch (err) {
    next(err)
  }
}

export const updateAddress = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params['id'] as string
    const { isDefault, ...rest } = req.body
    if (isDefault) {
      await prisma.address.updateMany({ where: { userId: req.user.id }, data: { isDefault: false } })
    }
    const address = await prisma.address.update({
      where: { id, userId: req.user.id },
      data: { ...rest, isDefault: !!isDefault },
    })
    res.json(address)
  } catch (err) {
    next(err)
  }
}

export const deleteAddress = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params['id'] as string
    await prisma.address.delete({ where: { id, userId: req.user.id } })
    res.json({ message: 'Address deleted' })
  } catch (err) {
    next(err)
  }
}
