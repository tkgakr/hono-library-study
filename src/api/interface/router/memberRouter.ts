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

export const memberRoute = createOpenApiHono()

// --- 一覧取得 GET /member ---
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
