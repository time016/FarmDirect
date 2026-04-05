import { Router } from 'express'
import { getCategories, createCategory, updateCategory } from '../controllers/category.controller'
import { authenticate, authorizeRoles } from '../middleware/auth'

const router = Router()

router.get('/', getCategories)
router.post('/', authenticate, authorizeRoles('ADMIN', 'HOST'), createCategory)
router.put('/:id', authenticate, authorizeRoles('ADMIN', 'HOST'), updateCategory)

export default router
