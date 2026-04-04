import { Router } from 'express'
import { getNotifications, getUnreadCount, markRead, markAllRead, deleteNotification, deleteAllNotifications } from '../controllers/notification.controller'
import { authenticate } from '../middleware/auth'

const router = Router()

router.get('/', authenticate, getNotifications)
router.get('/unread-count', authenticate, getUnreadCount)
router.put('/read-all', authenticate, markAllRead)
router.put('/:id/read', authenticate, markRead)
router.delete('/all', authenticate, deleteAllNotifications)
router.delete('/:id', authenticate, deleteNotification)

export default router
