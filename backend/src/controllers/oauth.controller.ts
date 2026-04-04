import { Request, Response } from 'express'
import jwt, { SignOptions } from 'jsonwebtoken'
import crypto from 'crypto'
import prisma from '../config/database'

function createOAuthState(): string {
  const nonce = crypto.randomBytes(16).toString('hex')
  const ts = Date.now().toString(36)
  const payload = `${nonce}.${ts}`
  const sig = crypto.createHmac('sha256', process.env.JWT_SECRET!).update(payload).digest('hex').slice(0, 16)
  return `${payload}.${sig}`
}

function verifyOAuthState(state: string): boolean {
  const parts = state.split('.')
  if (parts.length !== 3) return false
  const [nonce, ts, sig] = parts
  const payload = `${nonce}.${ts}`
  const expected = crypto.createHmac('sha256', process.env.JWT_SECRET!).update(payload).digest('hex').slice(0, 16)
  if (sig !== expected) return false
  const issued = parseInt(ts, 36)
  return Date.now() - issued <= 10 * 60 * 1000
}

const generateToken = (id: string) =>
  jwt.sign({ id }, process.env.JWT_SECRET as string, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  } as SignOptions)

const CLIENT_CALLBACK = () => process.env.CLIENT_OAUTH_CALLBACK || 'http://localhost:3000/auth/callback'

function redirectError(res: Response, msg: string) {
  return res.redirect(`${CLIENT_CALLBACK()}?error=${encodeURIComponent(msg)}`)
}

async function findOrCreateUser(opts: {
  provider: 'google' | 'line'
  providerId: string
  email: string | null
  name: string
  avatar: string | null
  emailVerified: boolean
}) {
  const idField = opts.provider === 'google' ? 'googleId' : 'lineId'
  const fallbackEmail = `${opts.provider}_${opts.providerId}@farmdirect.local`

  // 1. Find by provider ID → update emailVerified if needed and return
  let user = await prisma.user.findFirst({ where: { [idField]: opts.providerId } })
  if (user) {
    if (!user.emailVerified && opts.emailVerified) {
      return prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true },
      })
    }
    return user
  }

  // 2. Find by email → reject (don't auto-link, user must login with password first)
  if (opts.email) {
    user = await prisma.user.findUnique({ where: { email: opts.email } })
    if (user) throw new Error('email_exists')
  }

  // 3. Create new user
  return prisma.user.create({
    data: {
      email: opts.email || fallbackEmail,
      name: opts.name,
      avatar: opts.avatar,
      [idField]: opts.providerId,
      emailVerified: opts.emailVerified,
      password: null,
    },
  })
}

// ===================== GOOGLE =====================

export const googleAuth = (_req: Request, res: Response) => {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: process.env.GOOGLE_CALLBACK_URL!,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account',
  })
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
}

export const googleCallback = async (req: Request, res: Response) => {
  const { code, error } = req.query
  if (error || !code) return redirectError(res, 'google_cancelled')

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: code as string,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: process.env.GOOGLE_CALLBACK_URL!,
        grant_type: 'authorization_code',
      }),
    })
    const tokenData = await tokenRes.json() as any
    if (!tokenData.access_token) return redirectError(res, 'google_token_failed')

    const infoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })
    const g = await infoRes.json() as any

    const user = await findOrCreateUser({
      provider: 'google',
      providerId: g.sub,
      email: g.email || null,
      name: g.name || (g.email ?? 'User'),
      avatar: g.picture || null,
      emailVerified: !!g.email_verified,
    })

    if (!user.isActive) return redirectError(res, 'account_disabled')
    res.redirect(`${CLIENT_CALLBACK()}?token=${generateToken(user.id)}`)
  } catch (err: any) {
    redirectError(res, err.message === 'email_exists' ? 'email_exists' : 'google_auth_failed')
  }
}

// ===================== LINE =====================

export const lineAuth = (_req: Request, res: Response) => {
  const state = createOAuthState()
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.LINE_CLIENT_ID!,
    redirect_uri: process.env.LINE_CALLBACK_URL!,
    state,
    scope: 'profile openid email',
  })
  res.redirect(`https://access.line.me/oauth2/v2.1/authorize?${params}`)
}

export const lineCallback = async (req: Request, res: Response) => {
  const { code, state, error } = req.query
  if (error || !code) return redirectError(res, 'line_cancelled')
  if (!state || !verifyOAuthState(state as string)) return redirectError(res, 'invalid_state')

  try {
    const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: process.env.LINE_CALLBACK_URL!,
        client_id: process.env.LINE_CLIENT_ID!,
        client_secret: process.env.LINE_CLIENT_SECRET!,
      }),
    })
    const tokenData = await tokenRes.json() as any
    if (!tokenData.access_token) return redirectError(res, 'line_token_failed')

    const profileRes = await fetch('https://api.line.me/v2/profile', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })
    const lineUser = await profileRes.json() as any

    // Extract email from id_token JWT payload (if granted)
    let email: string | null = null
    if (tokenData.id_token) {
      try {
        const payload = JSON.parse(Buffer.from(tokenData.id_token.split('.')[1], 'base64url').toString())
        email = payload.email || null
      } catch {}
    }

    const user = await findOrCreateUser({
      provider: 'line',
      providerId: lineUser.userId,
      email,
      name: lineUser.displayName || 'LINE User',
      avatar: lineUser.pictureUrl || null,
      emailVerified: !!email,
    })

    if (!user.isActive) return redirectError(res, 'account_disabled')
    res.redirect(`${CLIENT_CALLBACK()}?token=${generateToken(user.id)}`)
  } catch (err: any) {
    redirectError(res, err.message === 'email_exists' ? 'email_exists' : 'line_auth_failed')
  }
}
