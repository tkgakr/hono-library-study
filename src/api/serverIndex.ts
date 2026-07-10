import { swaggerUI } from '@hono/swagger-ui'
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { loadEnv } from '@infrastructure/config/env'
import { getDbInstance } from '@infrastructure/database/dbAccess'
import { textLogger } from '@infrastructure/logger/logger'
import { globalErrorHandler } from '@infrastructure/middleware/errorHandler'
import { apiRouter } from '@interface/routerIndex'
import { serve } from 'bun'

const appConfig = loadEnv()
getDbInstance() // 起動時に接続を初期化

const app = new OpenAPIHono()

// --- ヘルスチェック: createRoute で OpenAPI 定義を作り、app.openapi で実装を結びつける ---
const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  responses: {
    200: {
      description: 'OK',
      content: {
        'application/json': {
          schema: z.object({ status: z.literal('ok') }),
        },
      },
    },
  },
})

app.openapi(healthRoute, (c) => c.json({ status: 'ok' as const }))

app.route('/', apiRouter)
// --- OpenAPI ドキュメント (/json)
app.doc('/json', {
  openapi: '3.1.0',
  info: { version: '1.0.0', title: '図書館システム学習API' },
})
// --- Swagger UI (/api-docs)
app.get('/api-docs', swaggerUI({ url: '/json' }))

app.onError(globalErrorHandler) // 例外を統一形式へ

const server = serve({ fetch: app.fetch, port: appConfig.system.port })
textLogger.info(`PORT ${server.port} で起動しました`)
