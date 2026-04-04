import { Request, Response, NextFunction } from 'express'
import bcrypt from 'bcryptjs'
import jwt, { SignOptions } from 'jsonwebtoken'
import prisma from '../config/database'
import { sendVerificationEmail } from '../utils/email'

const generateToken = (id: string) =>
  jwt.sign({ id }, process.env.JWT_SECRET as string, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  } as SignOptions)

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, name, phone, role } = req.body
    const exists = await prisma.user.findUnique({ where: { email } })
    if (exists) return res.status(400).json({ message: 'Email already in use' })

    const hashed = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: { email, password: hashed, name, phone, role: role === 'SELLER' ? 'SELLER' : 'BUYER' },
      select: { id: true, email: true, name: true, phone: true, avatar: true, role: true, isActive: true, emailVerified: true, createdAt: true },
    })
    res.status(201).json({ user, token: generateToken(user.id) })
  } catch (err) {
    next(err)
  }
}

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || !user.password || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid email or password' })
    }
    if (!user.isActive) return res.status(403).json({ message: 'Account is disabled' })

    const { password: _, ...userWithoutPassword } = user
    res.json({ user: userWithoutPassword, token: generateToken(user.id) })
  } catch (err) {
    next(err)
  }
}

export const getMe = async (req: Request, res: Response) => {
  const { password: _, emailVerifyCode: __, emailVerifyExpiry: ___, ...user } = req.user
  res.json(user)
}

export const sendVerifyEmail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } })
    if (!user) return res.status(404).json({ message: 'User not found' })
    if (user.emailVerified) return res.status(400).json({ message: 'Email already verified' })

    // Rate limit: don't resend if code still valid and sent < 1 min ago
    if (user.emailVerifyExpiry && user.emailVerifyExpiry.getTime() - Date.now() > 9 * 60 * 1000) {
      return res.status(429).json({ message: 'กรุณารอก่อนขอรหัสใหม่' })
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString()
    const expiry = new Date(Date.now() + 10 * 60 * 1000)

    await prisma.user.update({
      where: { id: req.user.id },
      data: { emailVerifyCode: code, emailVerifyExpiry: expiry },
    })

    await sendVerificationEmail(user.email, code)
    res.json({ message: 'Verification email sent' })
  } catch (err) {
    next(err)
  }
}

export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body
    const user = await prisma.user.findUnique({ where: { email } })
    // Always respond OK to prevent email enumeration
    if (!user || !user.isActive) return res.json({ message: 'sent' })

    const code = Math.floor(100000 + Math.random() * 900000).toString()
    const expiry = new Date(Date.now() + 15 * 60 * 1000) // 15 min

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: code, passwordResetExpiry: expiry },
    })

    await sendVerificationEmail(user.email, code, 'reset')
    res.json({ message: 'sent' })
  } catch (err) {
    next(err)
  }
}

export const verifyResetCode = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, code } = req.body
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || !user.passwordResetToken || !user.passwordResetExpiry) {
      return res.status(400).json({ message: 'รหัสไม่ถูกต้องหรือหมดอายุแล้ว' })
    }
    if (new Date() > user.passwordResetExpiry) {
      return res.status(400).json({ message: 'รหัสหมดอายุแล้ว กรุณาขอใหม่' })
    }
    if (user.passwordResetToken !== String(code)) {
      return res.status(400).json({ message: 'รหัสไม่ถูกต้อง' })
    }
    res.json({ message: 'valid' })
  } catch (err) {
    next(err)
  }
}

export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, code, password } = req.body
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || !user.passwordResetToken || !user.passwordResetExpiry) {
      return res.status(400).json({ message: 'รหัสไม่ถูกต้องหรือหมดอายุแล้ว' })
    }
    if (new Date() > user.passwordResetExpiry) return res.status(400).json({ message: 'รหัสหมดอายุแล้ว กรุณาขอใหม่' })
    if (user.passwordResetToken !== String(code)) return res.status(400).json({ message: 'รหัสไม่ถูกต้อง' })
    if (!password || password.length < 6) return res.status(400).json({ message: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัว' })

    const hashed = await bcrypt.hash(password, 10)
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, passwordResetToken: null, passwordResetExpiry: null },
    })
    res.json({ message: 'success' })
  } catch (err) {
    next(err)
  }
}

export const verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code } = req.body
    const user = await prisma.user.findUnique({ where: { id: req.user.id } })
    if (!user) return res.status(404).json({ message: 'User not found' })
    if (user.emailVerified) return res.status(400).json({ message: 'Already verified' })
    if (!user.emailVerifyCode || !user.emailVerifyExpiry) return res.status(400).json({ message: 'ยังไม่ได้ส่งรหัส' })
    if (new Date() > user.emailVerifyExpiry) return res.status(400).json({ message: 'รหัสหมดอายุแล้ว กรุณาขอใหม่' })
    if (user.emailVerifyCode !== String(code)) return res.status(400).json({ message: 'รหัสไม่ถูกต้อง' })

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: { emailVerified: true, emailVerifyCode: null, emailVerifyExpiry: null },
      select: { id: true, email: true, name: true, phone: true, avatar: true, role: true, isActive: true, emailVerified: true, createdAt: true },
    })
    res.json(updated)
  } catch (err) {
    next(err)
  }
}
