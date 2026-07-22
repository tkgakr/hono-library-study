import { falsyValueCheck, nullOrUndefinedCheck, promiseErrorReturn } from '@application/service/generic/utility'
import type { OperationResult } from '@domain/model/generic/generic'
import { ResultCodes } from '@domain/model/generic/generic'
import { inactivateMember } from '@domain/model/member/member'
import type { IMemberRepository } from '@domain/repository/member/memberRepository'
import type { ILogger } from '@domain/service/logger/iLoggerService'
import type { Result } from 'neverthrow'
import { ResultAsync } from 'neverthrow'

export const memberInactivateUsecase = async (
  repository: IMemberRepository,
  logger: ILogger,
  memberId: string,
): Promise<Result<boolean, OperationResult>> => {
  return ResultAsync.fromPromise(
    repository.fetchDetail(memberId),
    promiseErrorReturn(logger, ResultCodes.MEMBER_FETCH_FAILED),
  )
    .map((entity) => entity.value)
    .andThen(nullOrUndefinedCheck(ResultCodes.MEMBER_NOT_FOUND))
    .andThen((entity) =>
      ResultAsync.fromPromise(
        repository.save(inactivateMember(entity.id)),
        promiseErrorReturn(logger, ResultCodes.MEMBER_SAVE_FAILED),
      ),
    )
    .andThen(falsyValueCheck(ResultCodes.MEMBER_SAVE_FAILED))
}
