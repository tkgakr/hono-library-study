import { falsyValueCheck, promiseErrorReturn } from '@application/service/generic/utility'
import type { OperationResult } from '@domain/model/generic/generic'
import { ResultCodes } from '@domain/model/generic/generic'
import type { ValidatedCreateLoan } from '@domain/model/loan/loan'
import { createLoan } from '@domain/model/loan/loan'
import type { ILoanRepository } from '@domain/repository/loan/loanRepository'
import type { ILogger } from '@domain/service/logger/iLoggerService'
import type { Result } from 'neverthrow'
import { ok, ResultAsync } from 'neverthrow'

export const loanCreateUsecase = async (
  repository: ILoanRepository,
  logger: ILogger,
  validatedEntity: ValidatedCreateLoan,
): Promise<Result<boolean, OperationResult>> => {
  return ok(createLoan(validatedEntity))
    .asyncAndThen((created) =>
      ResultAsync.fromPromise(repository.save(created), promiseErrorReturn(logger, ResultCodes.LOAN_SAVE_FAILED)),
    )
    .andThen(falsyValueCheck(ResultCodes.LOAN_SAVE_FAILED))
}
