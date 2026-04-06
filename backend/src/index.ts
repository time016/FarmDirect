import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import errorHandler from './middleware/errorHandler'
import uploadRoutes from './routes/upload.routes'
import authRoutes from './routes/auth.routes'
import userRoutes from './routes/user.routes'
import farmRoutes from './routes/farm.routes'
import productRoutes from './routes/product.routes'
import categoryRoutes from './routes/category.routes'
import cartRoutes from './routes/cart.routes'
import orderRoutes from './routes/order.routes'
import paymentRoutes from './routes/payment.routes'
import reviewRoutes from './routes/review.routes'
import adminRoutes from './routes/admin.routes'
import notificationRoutes from './routes/notification.routes'

const app = express()
app.set('trust proxy', 1) // trust Railway's reverse proxy for rate-limit IP detection

// Middleware
const allowedOrigins = [
  process.env.CLIENT_URL,
].filter(Boolean)

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true)
    if (
      origin.startsWith('http://localhost') ||
      origin.startsWith('http://192.168.') ||
      origin.endsWith('.railway.app') ||
      allowedOrigins.includes(origin)
    ) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
}))
app.use(cookieParser())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Routes
app.use('/api/upload', uploadRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/farms', farmRoutes)
app.use('/api/products', productRoutes)
app.use('/api/categories', categoryRoutes)
app.use('/api/cart', cartRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/payments', paymentRoutes)
app.use('/api/reviews', reviewRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/notifications', notificationRoutes)

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }))

// Error handler
app.use(errorHandler)

const PORT = process.env.PORT || 5000
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
