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
