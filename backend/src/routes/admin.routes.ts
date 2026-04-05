import { Router } from 'express'
import { getUsers, updateUser, getFarms, getFarmsSummary, verifyFarm, getAllOrders, getDashboard, getPricingConfig, updatePricingConfig, getShippingConfig, updateShippingConfig, getFarmAdmins, addFarmAdmin, removeFarmAdmin, searchUsers } from '../controllers/admin.controller'
import { authenticate, authorizeRoles } from '../middleware/auth'

const router = Router()

router.use(authenticate, authorizeRoles('ADMIN', 'HOST'))
router.get('/dashboard', getDashboard)
router.get('/users/search', searchUsers)
router.get('/users', getUsers)
router.put('/users/:id', updateUser)
router.get('/farms', getFarms)
router.get('/farms/summary', getFarmsSummary)
router.get('/farms/:id/admins', getFarmAdmins)
router.post('/farms/:id/admins', addFarmAdmin)
router.delete('/farms/:id/admins/:userId', removeFarmAdmin)
router.put('/farms/:id/verify', verifyFarm)
router.get('/orders', getAllOrders)
router.get('/pricing', getPricingConfig)
router.put('/pricing', updatePricingConfig)
router.get('/shipping', getShippingConfig)
router.put('/shipping', updateShippingConfig)

export default router
