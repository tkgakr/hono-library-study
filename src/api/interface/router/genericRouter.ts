import type { RouteConfig } from '@hono/zod-openapi'
import { z } from '@hono/zod-openapi'
import type { HTTPStatusCode } from '@interface/model/generic'
import { apiStatusSchema, httpStatusCodes } from '@interface/model/generic'

export const idRequestParams = z.object({
  id: z.uuid().openapi({ example: '123e4567-e89b-12d3-a456-426614174000' }),
})

// 各ルートが spread して使う、共通のエラーレスポンス定義
type GenericErrorStatusCode = Exclude<HTTPStatusCode, typeof httpStatusCodes.OK>

export const genericResponse: Pick<RouteConfig['responses'], GenericErrorStatusCode> = {
  [httpStatusCodes.BAD_REQUEST]: {
    content: {
      'application/json': {
        schema: apiStatusSchema,
        example: { apiStatus: { code: 'W9901', message: 'パラメータが不正です' } },
      },
    },
    description: 'リクエストエラー(Bad Request)',
  },
  [httpStatusCodes.NOT_FOUND]: {
    content: {
      'application/json': {
        schema: apiStatusSchema,
        example: { apiStatus: { code: 'W0101', message: 'リソースが見つかりません' } },
      },
    },
    description: 'リソースが見つかりません(Not Found)',
  },
  [httpStatusCodes.INTERNAL_SERVER_ERROR]: {
    content: {
      'application/json': { schema: apiStatusSchema, example: { apiStatus: { code: 'E9999', message: '内部エラー' } } },
    },
    description: '内部エラー(Internal Server Error)',
  },
}

export const resultExamples = {
  status: { apiStatus: { code: 'I0000', message: '' } },
} as const
