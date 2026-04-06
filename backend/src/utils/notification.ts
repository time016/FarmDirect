import prisma from '../config/database'
import { sendNotificationEmail } from './email'

export async function notify(userId: string, type: string, title: string, body: string, link?: string) {
  return prisma.notification.create({ data: { userId, type, title, body, link } }).catch(() => {})
}

export async function notifyMany(userIds: string[], type: string, title: string, body: string, link?: string) {
  if (userIds.length === 0) return
  return prisma.notification.createMany({
    data: userIds.map((userId) => ({ userId, type, title, body, link })),
  }).catch(() => {})
}

export async function notifyAllAdmins(type: string, title: string, body: string, link?: string) {
  const admins = await prisma.user.findMany({ where: { role: { in: ['ADMIN', 'HOST'] }, isActive: true }, select: { id: true } })
  return notifyMany(admins.map((a) => a.id), type, title, body, link)
}

// notify + ส่ง email พร้อมกัน (ดึง email จาก userId อัตโนมัติ)
export async function notifyWithEmail(userId: string, type: string, title: string, body: string, link?: string) {
  const [user] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
    notify(userId, type, title, body, link),
  ])
  if (user?.email && !user.email.endsWith('@farmdirect.local')) {
    await sendNotificationEmail(user.email, title, title, body, link, type)
  }
}

// notifyMany + ส่ง email พร้อมกัน
export async function notifyManyWithEmail(userIds: string[], type: string, title: string, body: string, link?: string) {
  if (userIds.length === 0) return
  const [users] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true } }),
    notifyMany(userIds, type, title, body, link),
  ])
  await Promise.allSettled(
    users
      .filter((u) => u.email && !u.email.endsWith('@farmdirect.local'))
      .map((u) => sendNotificationEmail(u.email!, title, title, body, link))
  )
}
