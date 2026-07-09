import { bookActivateUsecase } from '@application/usecase/book/bookActivateUsecase'
import { bookCreateUsecase } from '@application/usecase/book/bookCreateUsecase'
import { bookGetDetailUsecase } from '@application/usecase/book/bookGetDetailUsecase'
import { bookGetListUsecase } from '@application/usecase/book/bookGetListUsecase'
import { bookInactivateUsecase } from '@application/usecase/book/bookInactivateUsecase'
import { bookUpdateUsecase } from '@application/usecase/book/bookUpdateUsecase'
import { getBookSchema } from '@domain/model/book/book'
import { ResultCodes } from '@domain/model/generic/generic'
import { createRoute } from '@hono/zod-openapi'
import bookRepository from '@infrastructure/database/repository/bookRepository'
import { textLogger } from '@infrastructure/logger/logger'
import { createOpenApiHono } from '@infrastructure/middleware/honoOpenApiFactory'
import { setResponse } from '@infrastructure/middleware/response'
import {
  unValidatedCreateBookSchema,
  unValidatedGetListBookUrlQuerySchema,
  unValidatedUpdateBookSchema,
  validateCreateBook,
  validateGetListBookUrlQuery,
  validateUpdateBook,
} from '@interface/model/book'
import { entityResultSchema, httpStatusCodes, listResultSchema, statusResultSchema } from '@interface/model/generic'
import { genericResponse, idRequestParams, resultExamples } from '@interface/router/genericRouter'

export const bookRoute = createOpenApiHono()

// --- 一覧取得 GET /books ---
const getListBookRoute = createRoute({
  path: '/',
  method: 'get',
  description: '蔵書一覧取得',
  tags: ['蔵書'],
  request: { query: unValidatedGetListBookUrlQuerySchema },
  responses: {
    ...genericResponse,
    [httpStatusCodes.OK]: {
      content: { 'application/json': { schema: listResultSchema(getBookSchema) } },
      description: '蔵書一覧取得成功',
    },
  },
})
bookRoute.openapi(getListBookRoute, async (c) => {
  const searchCondition = validateGetListBookUrlQuery(c.req.valid('query'))
  const result = await bookGetListUsecase(bookRepository, searchCondition, textLogger)
  return result.isOk() ? setResponse(c, { code: ResultCodes.SUCCESS }, result.value) : setResponse(c, result.error)
})

// --- 詳細取得 GET /books/{id} ---
const getDetailBookRoute = createRoute({
  path: '/{id}',
  method: 'get',
  description: '蔵書詳細取得',
  tags: ['蔵書'],
  request: { params: idRequestParams },
  responses: {
    ...genericResponse,
    [httpStatusCodes.OK]: {
      content: { 'application/json': { schema: entityResultSchema(getBookSchema) } },
      description: '蔵書詳細取得成功',
    },
  },
})
bookRoute.openapi(getDetailBookRoute, async (c) => {
  const result = await bookGetDetailUsecase(c.req.valid('param').id, bookRepository, textLogger)
  return result.isOk() ? setResponse(c, { code: ResultCodes.SUCCESS }, result.value) : setResponse(c, result.error)
})

// --- 作成 POST /books ---
const createBookRoute = createRoute({
  path: '/',
  method: 'post',
  description: '蔵書作成',
  tags: ['蔵書'],
  request: {
    body: { required: true, content: { 'application/json': { schema: unValidatedCreateBookSchema } } },
  },
  responses: {
    ...genericResponse,
    [httpStatusCodes.OK]: {
      content: { 'application/json': { schema: statusResultSchema, example: resultExamples.status } },
      description: '蔵書作成成功',
    },
  },
})
bookRoute.openapi(createBookRoute, async (c) => {
  const validatedRequest = validateCreateBook(c.req.valid('json'))
  const result = await bookCreateUsecase(bookRepository, textLogger, validatedRequest)
  return result.isOk() ? setResponse(c, { code: ResultCodes.SUCCESS }) : setResponse(c, result.error)
})

// --- 更新 PUT /books/{id} ---
const updateBookRoute = createRoute({
  path: '/{id}',
  method: 'put',
  description: '蔵書更新',
  tags: ['蔵書'],
  request: {
    params: idRequestParams,
    body: { required: true, content: { 'application/json': { schema: unValidatedUpdateBookSchema } } },
  },
  responses: {
    ...genericResponse,
    [httpStatusCodes.OK]: {
      content: { 'application/json': { schema: statusResultSchema, example: resultExamples.status } },
      description: '蔵書更新成功',
    },
  },
})
bookRoute.openapi(updateBookRoute, async (c) => {
  const validatedRequest = validateUpdateBook(c.req.valid('json'))
  const result = await bookUpdateUsecase(bookRepository, textLogger, c.req.valid('param').id, validatedRequest)
  return result.isOk() ? setResponse(c, { code: ResultCodes.SUCCESS }) : setResponse(c, result.error)
})

// --- 無効化（論理削除）DELETE /books/{id} ---
const inactivateBookRoute = createRoute({
  path: '/{id}',
  method: 'delete',
  description: '蔵書削除',
  tags: ['蔵書'],
  request: { params: idRequestParams },
  responses: {
    ...genericResponse,
    [httpStatusCodes.OK]: {
      content: { 'application/json': { schema: statusResultSchema, example: resultExamples.status } },
      description: '蔵書削除成功',
    },
  },
})
bookRoute.openapi(inactivateBookRoute, async (c) => {
  const result = await bookInactivateUsecase(bookRepository, textLogger, c.req.valid('param').id)
  return result.isOk() ? setResponse(c, { code: ResultCodes.SUCCESS }) : setResponse(c, result.error)
})

// --- 復元 PUT /books/activate/{id} ---
const activateBookRoute = createRoute({
  path: '/activate/{id}',
  method: 'put',
  description: '蔵書復元',
  tags: ['蔵書'],
  request: { params: idRequestParams },
  responses: {
    ...genericResponse,
    [httpStatusCodes.OK]: {
      content: { 'application/json': { schema: statusResultSchema, example: resultExamples.status } },
      description: '蔵書復元成功',
    },
  },
})
bookRoute.openapi(activateBookRoute, async (c) => {
  const result = await bookActivateUsecase(bookRepository, textLogger, c.req.valid('param').id)
  return result.isOk() ? setResponse(c, { code: ResultCodes.SUCCESS }) : setResponse(c, result.error)
})
