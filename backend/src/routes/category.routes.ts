import { Router } from 'express'
import { getCategories, createCategory, updateCategory } from '../controllers/category.controller'
import { authenticate, authorizeRoles } from '../middleware/auth'

const router = Router()

router.get('/', getCategories)
router.post('/', authenticate, authorizeRoles('ADMIN'), createCategory)
router.put('/:id', authenticate, authorizeRoles('ADMIN'), updateCategory)

export default router
