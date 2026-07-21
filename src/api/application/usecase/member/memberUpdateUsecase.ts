import { falsyValueCheck, nullOrUndefinedCheck, promiseErrorReturn } from '@application/service/generic/utility'
import { checkMemberEmailExists } from '@application/service/member/memberCheckService'
import type { OperationResult } from '@domain/model/generic/generic'
import { ResultCodes } from '@domain/model/generic/generic'
import type { ValidatedUpdateMember } from '@domain/model/member/member'
import { updateMember } from '@domain/model/member/member'
import type { IMemberRepository } from '@domain/repository/member/memberRepository'
import type { ILogger } from '@domain/service/logger/iLoggerService'
import type { Result } from 'neverthrow'
import { err, ok, ResultAsync } from 'neverthrow'

export const memberUpdateUsecase = async (
  repository: IMemberRepository,
  logger: ILogger,
  id: string,
  validatedEntity: ValidatedUpdateMember,
): Promise<Result<boolean, OperationResult>> => {
  return ResultAsync.fromPromise(
    repository.fetchDetail(id),
    promiseErrorReturn(logger, ResultCodes.MEMBER_FETCH_FAILED),
  )
    .map((entity) => entity.value)
    .andThen(nullOrUndefinedCheck(ResultCodes.MEMBER_NOT_FOUND))
    .andThrough((entity) =>
      entity.isActive ? ok(entity) : err({ code: ResultCodes.MEMBER_INVALID_STATE, args: { operation: '更新' } }),
    )
    .andThrough((entity) => checkMemberEmailExists(repository, logger, validatedEntity.email ?? '', entity.id))
    .andThen((entity) =>
      ResultAsync.fromPromise(
        repository.save(updateMember(entity.id, validatedEntity)),
        promiseErrorReturn(logger, ResultCodes.MEMBER_SAVE_FAILED),
      ),
    )
    .andThen(falsyValueCheck(ResultCodes.MEMBER_SAVE_FAILED))
}
