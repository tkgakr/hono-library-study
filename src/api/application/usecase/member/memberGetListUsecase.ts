import { promiseErrorReturn } from '@application/service/generic/utility'
import type { OperationResult } from '@domain/model/generic/generic'
import { ResultCodes } from '@domain/model/generic/generic'
import type { ListData } from '@domain/model/generic/repositoryData'
import type { GetMember } from '@domain/model/member/member'
import type { ValidatedGetListMemberSearchConditions } from '@domain/model/member/memberSearchConditions'
import type { IMemberRepository } from '@domain/repository/member/memberRepository'
import type { ILogger } from '@domain/service/logger/iLoggerService'
import type { Result } from 'neverthrow'
import { ResultAsync } from 'neverthrow'

export const memberGetListUsecase = async (
  repository: IMemberRepository,
  searchConditions: ValidatedGetListMemberSearchConditions,
  logger: ILogger,
): Promise<Result<ListData<GetMember>, OperationResult>> => {
  return ResultAsync.fromPromise(
    repository.fetchList(searchConditions),
    promiseErrorReturn(logger, ResultCodes.MEMBER_LIST_FAILED),
  )
}
