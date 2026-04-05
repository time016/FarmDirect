import { Router, Request, Response } from 'express'
import { v2 as cloudinary } from 'cloudinary'
import upload from '../middleware/upload'
import { authenticate } from '../middleware/auth'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const router = Router()

router.post('/', authenticate, upload.single('image'), async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' })

  try {
    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'farmdirect', resource_type: 'image' },
        (error, result) => {
          if (error || !result) return reject(error)
          resolve(result)
        }
      )
      stream.end(req.file!.buffer)
    })

    res.json({ url: result.secure_url })
  } catch (err) {
    res.status(500).json({ message: 'Upload failed' })
  }
})

export default router
