import { Router, Request, Response } from 'express'
import upload from '../middleware/upload'
import { authenticate } from '../middleware/auth'

const router = Router()

router.post('/', authenticate, upload.single('image'), (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' })
  const url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`
  res.json({ url })
})

export default router
