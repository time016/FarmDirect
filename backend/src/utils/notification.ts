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

export async function notifyAllAdminsWithEmail(type: string, title: string, body: string, link?: string) {
  const admins = await prisma.user.findMany({ where: { role: { in: ['ADMIN', 'HOST'] }, isActive: true }, select: { id: true, email: true } })
  await notifyMany(admins.map((a) => a.id), type, title, body, link)
  for (const admin of admins) {
    if (admin.email && !admin.email.endsWith('@farmdirect.local')) {
      sendNotificationEmail(admin.email, title, title, body, link, type).catch(() => {})
    }
  }
}

// notify + ส่ง email พร้อมกัน (ดึง email จาก userId อัตโนมัติ)
export async function notifyWithEmail(userId: string, type: string, title: string, body: string, link?: string) {
  // บันทึก notification ใน DB ก่อน (await)
  await notify(userId, type, title, body, link)
  // ส่ง email ใน background — ไม่ block API response
  prisma.user.findUnique({ where: { id: userId }, select: { email: true } }).then((user) => {
    if (user?.email && !user.email.endsWith('@farmdirect.local')) {
      sendNotificationEmail(user.email, title, title, body, link, type).catch(() => {})
    }
  }).catch(() => {})
}

export async function notifyManyWithEmail(userIds: string[], type: string, title: string, body: string, link?: string) {
  if (userIds.length === 0) return
  await notifyMany(userIds, type, title, body, link)
  prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true } }).then((users) => {
    for (const u of users) {
      if (u.email && !u.email.endsWith('@farmdirect.local')) {
        sendNotificationEmail(u.email, title, title, body, link, type).catch(() => {})
      }
    }
  }).catch(() => {})
}
