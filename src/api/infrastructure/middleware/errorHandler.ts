import { ResultCodes } from '@domain/model/generic/generic'
import { setResponse } from '@infrastructure/middleware/response'
import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import z from 'zod'

export const globalErrorHandler = (err: Error, c: Context): Response => {
  if (err instanceof z.ZodError) {
    return setResponse(c, {
      code: ResultCodes.VALIDATION_FAILED,
      args: { invalidParameters: getZodErrorPathStrings(err) },
    })
  }
  if (err.message === 'Malformed JSON in request body') {
    return setResponse(c, { code: ResultCodes.INVALID_REQUEST_FORMAT })
  }
  if (err instanceof HTTPException) {
    return err.getResponse()
  }
  return setResponse(c, { code: ResultCodes.INTERNAL_ERROR })
}

// ZodError から「どの項目が不正か」を文字列化する
export const getZodErrorPathStrings = (error: z.ZodError) =>
  error.issues.map((issue) => issue.path.join('.')).join(', ')
