import { Router } from 'express'
import { createOrder, getMyOrders, getOrder, getSellerOrders, updateOrderStatus, cancelOrder, confirmDelivery } from '../controllers/order.controller'
import { authenticate, authorizeRoles, authorizeFarmMember } from '../middleware/auth'

const router = Router()

router.use(authenticate)
router.post('/', authorizeRoles('BUYER', 'SELLER'), createOrder)
router.get('/', authorizeRoles('BUYER', 'SELLER'), getMyOrders)
router.get('/seller', authorizeFarmMember, getSellerOrders)
router.get('/:id', getOrder)
router.put('/:id/cancel', authorizeRoles('BUYER', 'SELLER'), cancelOrder)
router.put('/:id/confirm-delivery', authorizeRoles('BUYER', 'SELLER'), confirmDelivery)
router.put('/:id/status', authorizeFarmMember, updateOrderStatus)

export default router
