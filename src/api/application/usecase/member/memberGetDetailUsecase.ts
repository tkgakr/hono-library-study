import { nullOrUndefinedCheck, promiseErrorReturn } from '@application/service/generic/utility'
import type { OperationResult } from '@domain/model/generic/generic'
import { ResultCodes } from '@domain/model/generic/generic'
import type { EntityData } from '@domain/model/generic/repositoryData'
import type { GetMember } from '@domain/model/member/member'
import type { IMemberRepository } from '@domain/repository/member/memberRepository'
import type { ILogger } from '@domain/service/logger/iLoggerService'
import type { Result } from 'neverthrow'
import { ResultAsync } from 'neverthrow'

export const memberGetDetailUsecase = async (
  id: string,
  repository: IMemberRepository,
  logger: ILogger,
): Promise<Result<EntityData<GetMember>, OperationResult>> => {
  return ResultAsync.fromPromise(
    repository.fetchDetail(id),
    promiseErrorReturn(logger, ResultCodes.MEMBER_FETCH_FAILED),
  ).andThrough((entity) => nullOrUndefinedCheck(ResultCodes.MEMBER_NOT_FOUND)(entity.value))
}
