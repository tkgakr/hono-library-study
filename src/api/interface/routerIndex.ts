import { createOpenApiHono } from '@infrastructure/middleware/honoOpenApiFactory'
import { bookRoute } from '@interface/router/bookRouter'
import { memberRoute } from '@interface/router/memberRouter'

export const apiRouter = createOpenApiHono()
apiRouter.route('/books', bookRoute)
apiRouter.route('/members', memberRoute)
