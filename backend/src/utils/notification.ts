import prisma from '../config/database'

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
