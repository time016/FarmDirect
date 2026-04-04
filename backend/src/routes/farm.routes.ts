import { Router } from 'express'
import { createFarm, getFarms, getFarm, getMyFarm, updateFarm, resubmitFarm, getFarmAnalytics, getMyFarmSummary, createFarmReview, getFarmReviews, toggleFarmLike, getFarmLikeStatus, getCanReview, getFarmApprovalLogs, updateShippingRate, getPublicShippingConfig, getMyFarmAdmins, addMyFarmAdmin, removeMyFarmAdmin, searchUsersForFarm, getMyInvitations, acceptInvitation, declineInvitation, getMyFarmMemberships } from '../controllers/farm.controller'
import { authenticate, authorizeRoles, authorizeFarmMember } from '../middleware/auth'

const router = Router()

router.get('/', getFarms)
router.get('/my', authenticate, authorizeFarmMember, getMyFarm)
router.get('/analytics', authenticate, authorizeFarmMember, getFarmAnalytics)
router.get('/summary', authenticate, authorizeFarmMember, getMyFarmSummary)
router.get('/shipping-config', getPublicShippingConfig)
router.put('/shipping', authenticate, authorizeRoles('SELLER', 'ADMIN'), updateShippingRate)
router.get('/admins/search-users', authenticate, authorizeRoles('SELLER', 'ADMIN'), searchUsersForFarm)
router.get('/admins', authenticate, authorizeRoles('SELLER', 'ADMIN'), getMyFarmAdmins)
router.post('/admins', authenticate, authorizeRoles('SELLER', 'ADMIN'), addMyFarmAdmin)
router.delete('/admins/:userId', authenticate, authorizeRoles('SELLER', 'ADMIN'), removeMyFarmAdmin)
router.get('/invitations', authenticate, getMyInvitations)
router.post('/invitations/:id/accept', authenticate, acceptInvitation)
router.delete('/invitations/:id', authenticate, declineInvitation)
router.get('/memberships', authenticate, getMyFarmMemberships)
router.get('/:id/reviews', getFarmReviews)
router.post('/:id/reviews', authenticate, createFarmReview)
router.get('/:id/can-review', authenticate, getCanReview)
router.get('/:id/like-status', getFarmLikeStatus)
router.post('/:id/like', authenticate, toggleFarmLike)
router.get('/:id', getFarm)
router.post('/', authenticate, authorizeRoles('SELLER', 'ADMIN'), createFarm)
router.put('/', authenticate, authorizeRoles('SELLER', 'ADMIN'), updateFarm)
router.post('/resubmit', authenticate, authorizeRoles('SELLER', 'ADMIN'), resubmitFarm)
router.get('/:id/approval-logs', authenticate, authorizeRoles('ADMIN'), getFarmApprovalLogs)

export default router
