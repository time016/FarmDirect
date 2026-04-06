import { Request, Response, NextFunction } from 'express'
import bcrypt from 'bcryptjs'
import jwt, { SignOptions } from 'jsonwebtoken'
import crypto from 'crypto'
import prisma from '../config/database'
import { sendVerificationEmail } from '../utils/email'

const isProd = process.env.NODE_ENV === 'production'

export const generateAccessToken = (id: string) =>
  jwt.sign({ id }, process.env.JWT_SECRET as string, { expiresIn: '15m' } as SignOptions)

const REFRESH_COOKIE_OPTS = {
  httpOnly: true,
  secure: isProd,
  sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
}

async function issueRefreshToken(userId: string, res: Response) {
  const token = crypto.randomBytes(40).toString('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  await prisma.refreshToken.create({ data: { token, userId, expiresAt } })
  res.cookie('refreshToken', token, REFRESH_COOKIE_OPTS)
  return token
}

const USER_SELECT = {
  id: true, email: true, name: true, phone: true, avatar: true,
  role: true, isActive: true, emailVerified: true, createdAt: true,
}

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, name, phone, role } = req.body
    const exists = await prisma.user.findUnique({ where: { email } })
    if (exists) return res.status(400).json({ message: 'Email already in use' })

    const hashed = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: { email, password: hashed, name, phone, role: role === 'SELLER' ? 'SELLER' : 'BUYER' },
      select: USER_SELECT,
    })
    await issueRefreshToken(user.id, res)
    res.status(201).json({ user, token: generateAccessToken(user.id) })
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
    await issueRefreshToken(user.id, res)
    res.json({ user: userWithoutPassword, token: generateAccessToken(user.id) })
  } catch (err) {
    next(err)
  }
}

export const refresh = async (req: Request, res: Response) => {
  const token = req.cookies?.refreshToken
  if (!token) return res.status(401).json({ message: 'No refresh token' })

  const stored = await prisma.refreshToken.findUnique({
    where: { token },
    include: { user: { select: USER_SELECT } },
  })
  if (!stored || stored.expiresAt < new Date()) {
    res.clearCookie('refreshToken', REFRESH_COOKIE_OPTS)
    return res.status(401).json({ message: 'Invalid or expired refresh token' })
  }
  if (!stored.user.isActive) return res.status(403).json({ message: 'Account is disabled' })

  // Rotate: delete old, issue new
  await prisma.refreshToken.delete({ where: { token } })
  await issueRefreshToken(stored.userId, res)
  res.json({ user: stored.user, token: generateAccessToken(stored.userId) })
}

export const logout = async (req: Request, res: Response) => {
  const token = req.cookies?.refreshToken
  if (token) {
    await prisma.refreshToken.deleteMany({ where: { token } }).catch(() => {})
  }
  res.clearCookie('refreshToken', REFRESH_COOKIE_OPTS)
  res.json({ message: 'Logged out' })
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

    if (user.emailVerifyExpiry && user.emailVerifyExpiry.getTime() - Date.now() > 9 * 60 * 1000) {
      return res.status(429).json({ message: 'กรุณารอก่อนขอรหัสใหม่' })
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString()
    const expiry = new Date(Date.now() + 10 * 60 * 1000)

    await prisma.user.update({
      where: { id: req.user.id },
      data: { emailVerifyCode: code, emailVerifyExpiry: expiry },
    })

    sendVerificationEmail(user.email, code).catch((err) => console.error('[EMAIL ERROR]', err.message))
    res.json({ message: 'Verification email sent' })
  } catch (err) {
    next(err)
  }
}

export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || !user.isActive) return res.json({ message: 'sent' })

    const code = Math.floor(100000 + Math.random() * 900000).toString()
    const expiry = new Date(Date.now() + 15 * 60 * 1000)

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: code, passwordResetExpiry: expiry },
    })

    sendVerificationEmail(user.email, code, 'reset').catch((err) => console.error('[EMAIL ERROR]', err.message))
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
      select: USER_SELECT,
    })
    res.json(updated)
  } catch (err) {
    next(err)
  }
}
