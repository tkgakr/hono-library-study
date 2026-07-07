import { ResultCodes } from '@domain/model/generic/generic'
import { OpenAPIHono } from '@hono/zod-openapi'
import { getZodErrorPathStrings } from '@infrastructure/middleware/errorHandler'
import { setResponse } from '@infrastructure/middleware/response'
import type { Env } from 'hono'

// 各ルーターは素の new OpenAPIHono() ではなく、このファクトリ経由で作ります。
// createRoute に宣言したスキーマの自動検証が失敗したときの挙動（defaultHook）を全ルーター共通で仕込むためです。
export const createOpenApiHono = <E extends Env = Env>() =>
  new OpenAPIHono<E>({
    defaultHook: (result, c) => {
      if (!result.success) {
        return setResponse(c, {
          code: ResultCodes.VALIDATION_FAILED,
          args: { invalidParameters: getZodErrorPathStrings(result.error) },
        })
      }
    },
  })
