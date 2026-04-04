import { Router } from 'express'
import { getCart, addToCart, updateCartItem, removeCartItem, clearCart } from '../controllers/cart.controller'
import { authenticate, authorizeRoles } from '../middleware/auth'

const router = Router()

router.use(authenticate, authorizeRoles('BUYER', 'SELLER'))
router.get('/', getCart)
router.post('/items', addToCart)
router.put('/items/:itemId', updateCartItem)
router.delete('/items/:itemId', removeCartItem)
router.delete('/', clearCart)

export default router
