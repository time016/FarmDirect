import { Router } from 'express'
import { createOrder, getMyOrders, getOrder, getSellerOrders, updateOrderStatus, cancelOrder, confirmDelivery } from '../controllers/order.controller'
import { authenticate, authorizeRoles, authorizeFarmMember } from '../middleware/auth'

const router = Router()

router.use(authenticate)
router.post('/', createOrder)
router.get('/', getMyOrders)
router.get('/seller', authorizeFarmMember, getSellerOrders)
router.get('/:id', getOrder)
router.put('/:id/cancel', cancelOrder)
router.put('/:id/confirm-delivery', confirmDelivery)
router.put('/:id/status', authorizeFarmMember, updateOrderStatus)

export default router
