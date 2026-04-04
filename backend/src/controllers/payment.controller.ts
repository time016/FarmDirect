import { Request, Response, NextFunction } from 'express'
import prisma from '../config/database'

export const createPayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orderId, method } = req.body

    const order = await prisma.order.findUnique({ where: { id: orderId as string, userId: req.user.id } })
    if (!order) return res.status(404).json({ message: 'Order not found' })
    if (order.status !== 'PENDING') return res.status(400).json({ message: 'Order is not pending' })

    const existingPayment = await prisma.payment.findUnique({ where: { orderId: orderId as string } })
    if (existingPayment) return res.status(400).json({ message: 'Payment already exists' })

    const payment = await prisma.payment.create({
      data: { orderId, method, amount: order.totalAmount },
    })

    // TODO: Integrate with payment gateway (Omise / 2C2P)
    // For now, simulate payment success
    const updatedPayment = await prisma.$transaction(async (tx) => {
      const paid = await tx.payment.update({
        where: { id: payment.id },
        data: { status: 'SUCCESS', paidAt: new Date(), transactionId: `TXN-${Date.now()}` },
      })
      await tx.order.update({ where: { id: orderId }, data: { status: 'PAID' } })
      return paid
    })

    res.status(201).json(updatedPayment)
  } catch (err) {
    next(err)
  }
}

export const getPayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orderId = req.params['orderId'] as string
    const payment = await prisma.payment.findUnique({
      where: { orderId },
      include: { order: { select: { userId: true, totalAmount: true, status: true } } },
    })
    if (!payment) return res.status(404).json({ message: 'Payment not found' })
    if (payment.order.userId !== req.user.id && req.user.role === 'BUYER') {
      return res.status(403).json({ message: 'Forbidden' })
    }
    res.json(payment)
  } catch (err) {
    next(err)
  }
}
