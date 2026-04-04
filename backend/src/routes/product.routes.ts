import { Router } from 'express'
import { getProducts, getProduct, createProduct, updateProduct, deleteProduct, getPublicPricingConfig } from '../controllers/product.controller'
import { authenticate, authorizeRoles, authorizeFarmMember } from '../middleware/auth'

const router = Router()

router.get('/pricing-config', getPublicPricingConfig)
router.get('/', getProducts)
router.get('/:id', getProduct)
router.post('/', authenticate, authorizeFarmMember, createProduct)
router.put('/:id', authenticate, authorizeFarmMember, updateProduct)
router.delete('/:id', authenticate, authorizeFarmMember, deleteProduct)

export default router
