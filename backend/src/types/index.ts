import { User } from '@prisma/client'

export interface JwtPayload {
  id: string
}

declare global {
  namespace Express {
    interface Request {
      user: User
    }
  }
}
