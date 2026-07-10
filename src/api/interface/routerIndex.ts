import { createOpenApiHono } from '@infrastructure/middleware/honoOpenApiFactory'
import { bookRoute } from '@interface/router/bookRouter'

export const apiRouter = createOpenApiHono()
apiRouter.route('/books', bookRoute)
