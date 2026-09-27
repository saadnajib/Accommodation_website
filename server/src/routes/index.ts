import { Router } from 'express'
import { listingsRouter } from './listings.js'
import { applicationsRouter } from './applications.js'
import { messagesRouter } from './messages.js'
import { reviewsRouter } from './reviews.js'
import { meRouter } from './me.js'
import { adminRouter } from './admin.js'

// Domain routers are mounted here (each declares its full path under /api). See API.md for the contract.
export const apiRouter = Router()
apiRouter.use(listingsRouter)
apiRouter.use(applicationsRouter)
apiRouter.use(messagesRouter)
apiRouter.use(reviewsRouter)
apiRouter.use(meRouter)
apiRouter.use(adminRouter)
