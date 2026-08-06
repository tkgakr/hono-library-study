import { promiseErrorReturn } from '@application/service/generic/utility'
import { toCalendarDate } from '@core/core'
import type { OperationResult } from '@domain/model/generic/generic'
import { ResultCodes } from '@domain/model/generic/generic'
import type { ListData } from '@domain/model/generic/repositoryData'
import type { LoanListItem } from '@domain/model/loan/loanListItem'
import type { ValidatedGetListLoanSearchConditions } from '@domain/model/loan/loanSearchConditions'
import type { ILoanRepository } from '@domain/repository/loan/loanRepository'
import type { ILogger } from '@domain/service/logger/iLoggerService'
import type { Result } from 'neverthrow'
import { ResultAsync } from 'neverthrow'

export const loanGetListUsecase = async (
  repository: ILoanRepository,
  searchConditions: ValidatedGetListLoanSearchConditions,
  logger: ILogger,
): Promise<Result<ListData<LoanListItem>, OperationResult>> => {
  // 時計を読むのはここ1箇所。テストでは固定日を渡した repository スタブを使う
  return ResultAsync.fromPromise(
    repository.fetchListWithRelations(toCalendarDate(new Date()), searchConditions),
    promiseErrorReturn(logger, ResultCodes.LOAN_LIST_FAILED),
  )
}
