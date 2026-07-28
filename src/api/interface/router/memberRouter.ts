import { memberActivateUsecase } from '@application/usecase/member/memberActivateUsecase'
import { memberCreateUsecase } from '@application/usecase/member/memberCreateUsecase'
import { memberGetDetailUsecase } from '@application/usecase/member/memberGetDetailUsecase'
import { memberGetListUsecase } from '@application/usecase/member/memberGetListUsecase'
import { memberInactivateUsecase } from '@application/usecase/member/memberInactivateUsecase'
import { memberUpdateUsecase } from '@application/usecase/member/memberUpdateUsecase'
import { ResultCodes } from '@domain/model/generic/generic'
import { getMemberSchema } from '@domain/model/member/member'
import { createRoute } from '@hono/zod-openapi'
import memberRepository from '@infrastructure/database/repository/memberRepository'
import { textLogger } from '@infrastructure/logger/logger'
import { createOpenApiHono } from '@infrastructure/middleware/honoOpenApiFactory'
import { setResponse } from '@infrastructure/middleware/response'
import { entityResultSchema, httpStatusCodes, listResultSchema, statusResultSchema } from '@interface/model/generic'
import {
  unValidatedCreateMemberSchema,
  unValidatedGetListMemberUrlQuerySchema,
  unValidatedUpdateMemberSchema,
  validateCreateMember,
  validateGetListMemberUrlQuery,
  validateUpdateMember,
} from '@interface/model/member'
import { genericResponse, idRequestParams, resultExamples } from '@interface/router/genericRouter'
import { desc } from 'drizzle-orm'

export const memberRoute = createOpenApiHono()

// --- 一覧取得 GET /members ---
const getListMemberRoute = createRoute({
  path: '/',
  method: 'get',
  description: '利用者一覧取得',
  tags: ['利用者'],
  request: { query: unValidatedGetListMemberUrlQuerySchema },
  responses: {
    ...genericResponse,
    [httpStatusCodes.OK]: {
      content: { 'application/json': { schema: listResultSchema(getMemberSchema) } },
      description: '利用者一覧取得成功',
    },
  },
})
memberRoute.openapi(getListMemberRoute, async (c) => {
  const searchCondition = validateGetListMemberUrlQuery(c.req.valid('query'))
  const result = await memberGetListUsecase(memberRepository, searchCondition, textLogger)
  return result.isOk() ? setResponse(c, { code: ResultCodes.SUCCESS }, result.value) : setResponse(c, result.error)
})

// --- 詳細取得 GET /members/{id} ---
const getDetailMemberRoute = createRoute({
  path: '/{id}',
  method: 'get',
  description: '利用者詳細取得',
  tags: ['利用者'],
  request: { params: idRequestParams },
  responses: {
    ...genericResponse,
    [httpStatusCodes.OK]: {
      content: { 'application/json': { schema: entityResultSchema(getMemberSchema) } },
      description: '利用者詳細取得成功',
    },
  },
})
memberRoute.openapi(getDetailMemberRoute, async (c) => {
  const result = await memberGetDetailUsecase(c.req.valid('param').id, memberRepository, textLogger)
  return result.isOk() ? setResponse(c, { code: ResultCodes.SUCCESS }, result.value) : setResponse(c, result.error)
})

// --- 作成 POST /members ---
const createMemberRoute = createRoute({
  path: '/',
  method: 'post',
  description: '利用者作成',
  tags: ['利用者'],
  request: {
    body: { required: true, content: { 'application/json': { schema: unValidatedCreateMemberSchema } } },
  },
  responses: {
    ...genericResponse,
    [httpStatusCodes.OK]: {
      content: { 'application/json': { schema: statusResultSchema, example: resultExamples.status } },
      description: '利用者作成成功',
    },
  },
})
memberRoute.openapi(createMemberRoute, async (c) => {
  const validatedRequest = validateCreateMember(c.req.valid('json'))
  const result = await memberCreateUsecase(memberRepository, textLogger, validatedRequest)
  return result.isOk() ? setResponse(c, { code: ResultCodes.SUCCESS }) : setResponse(c, result.error)
})

// --- 更新 PUT /members/{id} ---
const updateMemberRoute = createRoute({
  path: '/{id}',
  method: 'put',
  description: '利用者更新',
  tags: ['利用者'],
  request: {
    params: idRequestParams,
    body: { required: true, content: { 'application/json': { schema: unValidatedUpdateMemberSchema } } },
  },
  responses: {
    ...genericResponse,
    [httpStatusCodes.OK]: {
      content: { 'application/json': { schema: statusResultSchema, example: resultExamples.status } },
      description: '利用者更新成功',
    },
  },
})
memberRoute.openapi(updateMemberRoute, async (c) => {
  const validatedRequest = validateUpdateMember(c.req.valid('json'))
  const result = await memberUpdateUsecase(memberRepository, textLogger, c.req.valid('param').id, validatedRequest)
  return result.isOk() ? setResponse(c, { code: ResultCodes.SUCCESS }) : setResponse(c, result.error)
})

// --- 無効化（論理削除）DELETE /members/{id} ---
const inactivateMemberRoute = createRoute({
  path: '/{id}',
  method: 'delete',
  description: '利用者削除',
  tags: ['利用者'],
  request: { params: idRequestParams },
  responses: {
    ...genericResponse,
    [httpStatusCodes.OK]: {
      content: { 'application/json': { schema: statusResultSchema, example: resultExamples.status } },
      description: '利用者削除成功',
    },
  },
})
memberRoute.openapi(inactivateMemberRoute, async (c) => {
  const result = await memberInactivateUsecase(memberRepository, textLogger, c.req.valid('param').id)
  return result.isOk() ? setResponse(c, { code: ResultCodes.SUCCESS }) : setResponse(c, result.error)
})
