import { Request, Response, NextFunction } from 'express'

const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack)
  const status = err.status || 500
  res.status(status).json({
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  })
}

export default errorHandler
