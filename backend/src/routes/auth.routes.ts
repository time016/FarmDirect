import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { register, login, refresh, logout, getMe, sendVerifyEmail, verifyEmail, forgotPassword, resetPassword, verifyResetCode } from '../controllers/auth.controller'
import { googleAuth, googleCallback, lineAuth, lineCallback } from '../controllers/oauth.controller'
import { authenticate } from '../middleware/auth'

const router = Router()

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'ลองเข้าสู่ระบบบ่อยเกินไป กรุณารอ 15 นาทีแล้วลองใหม่' },
  standardHeaders: true,
  legacyHeaders: false,
})

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { message: 'สมัครบัญชีบ่อยเกินไป กรุณารอ 1 ชั่วโมงแล้วลองใหม่' },
  standardHeaders: true,
  legacyHeaders: false,
})

const passwordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: 'ส่งคำขอบ่อยเกินไป กรุณารอ 15 นาทีแล้วลองใหม่' },
  standardHeaders: true,
  legacyHeaders: false,
})

const verifyEmailLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 3,
  message: { message: 'ขอรหัสยืนยันบ่อยเกินไป กรุณารอ 10 นาทีแล้วลองใหม่' },
  standardHeaders: true,
  legacyHeaders: false,
})

router.post('/register', registerLimiter, register)
router.post('/login', loginLimiter, login)
router.post('/refresh', refresh)
router.post('/logout', logout)
router.get('/me', authenticate, getMe)
router.post('/send-verify-email', authenticate, verifyEmailLimiter, sendVerifyEmail)
router.post('/verify-email', authenticate, verifyEmail)
router.post('/forgot-password', passwordLimiter, forgotPassword)
router.post('/verify-reset-code', passwordLimiter, verifyResetCode)
router.post('/reset-password', passwordLimiter, resetPassword)

// OAuth
router.get('/google', googleAuth)
router.get('/google/callback', googleCallback)
router.get('/line', lineAuth)
router.get('/line/callback', lineCallback)

export default router
