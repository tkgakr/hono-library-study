import { swaggerUI } from '@hono/swagger-ui'
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { serve } from 'bun'

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

// --- OpenAPI ドキュメント (/json) と Swagger UI (/api-docs) ---
app.doc('/json', {
  openapi: '3.1.0',
  info: { version: '1.0.0', title: '図書館システムAPI' },
})
app.get('/api-docs', swaggerUI({ url: '/json' }))

const server = serve({
  fetch: app.fetch,
  port: Number(process.env.PORT ?? 3000),
})

console.log(`PORT ${server.port} で起動しました`)
