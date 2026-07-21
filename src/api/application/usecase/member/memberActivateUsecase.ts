import { falsyValueCheck, nullOrUndefinedCheck, promiseErrorReturn } from '@application/service/generic/utility'
import { checkMemberEmailExists } from '@application/service/member/memberCheckService'
import type { OperationResult } from '@domain/model/generic/generic'
import { ResultCodes } from '@domain/model/generic/generic'
import { activateMember } from '@domain/model/member/member'
import type { IMemberRepository } from '@domain/repository/member/memberRepository'
import type { ILogger } from '@domain/service/logger/iLoggerService'
import type { Result } from 'neverthrow'
import { err, ok, ResultAsync } from 'neverthrow'

export const memberActivateUsecase = async (
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
      entity.isActive ? err({ code: ResultCodes.MEMBER_INVALID_STATE, args: { operation: '復元' } }) : ok(entity),
    )
    .andThrough((entity) => checkMemberEmailExists(repository, logger, entity.email, entity.id))
    .andThen((entity) =>
      ResultAsync.fromPromise(
        repository.save(activateMember(entity.id)),
        promiseErrorReturn(logger, ResultCodes.MEMBER_SAVE_FAILED),
      ),
    )
    .andThen(falsyValueCheck(ResultCodes.MEMBER_SAVE_FAILED))
}
