import { Router } from 'express'
import { getProfile, updateProfile, becomeSeller, getAddresses, createAddress, updateAddress, deleteAddress } from '../controllers/user.controller'
import { authenticate } from '../middleware/auth'

const router = Router()

router.use(authenticate)
router.get('/profile', getProfile)
router.put('/profile', updateProfile)
router.post('/become-seller', becomeSeller)
router.get('/addresses', getAddresses)
router.post('/addresses', createAddress)
router.put('/addresses/:id', updateAddress)
router.delete('/addresses/:id', deleteAddress)

export default router
