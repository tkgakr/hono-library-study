import { falsyValueCheck, promiseErrorReturn } from '@application/service/generic/utility'
import { checkMemberEmailExists } from '@application/service/member/memberCheckService'
import type { OperationResult } from '@domain/model/generic/generic'
import { ResultCodes } from '@domain/model/generic/generic'
import type { ValidatedCreateMember } from '@domain/model/member/member'
import { createMember } from '@domain/model/member/member'
import type { IMemberRepository } from '@domain/repository/member/memberRepository'
import type { ILogger } from '@domain/service/logger/iLoggerService'
import type { Result } from 'neverthrow'
import { ok, ResultAsync } from 'neverthrow'

export const memberCreateUsecase = async (
  repository: IMemberRepository,
  logger: ILogger,
  validatedEntity: ValidatedCreateMember,
): Promise<Result<boolean, OperationResult>> => {
  return ok(createMember(validatedEntity))
    .asyncAndThrough((created) => checkMemberEmailExists(repository, logger, created.email))
    .andThen((created) =>
      ResultAsync.fromPromise(repository.save(created), promiseErrorReturn(logger, ResultCodes.MEMBER_SAVE_FAILED)),
    )
    .andThen(falsyValueCheck(ResultCodes.MEMBER_SAVE_FAILED))
}
