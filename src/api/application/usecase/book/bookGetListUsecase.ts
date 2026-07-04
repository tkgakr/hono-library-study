import { promiseErrorReturn } from '@application/service/generic/utility'
import type { GetBook } from '@domain/model/book/book'
import type { ValidatedGetListBookSearchConditions } from '@domain/model/book/bookSearchConditions'
import type { OperationResult } from '@domain/model/generic/generic'
import { ResultCodes } from '@domain/model/generic/generic'
import type { ListData } from '@domain/model/generic/repositoryData'
import type { IBookRepository } from '@domain/repository/book/bookRepository'
import type { ILogger } from '@domain/service/logger/iLoggerService'
import type { Result } from 'neverthrow'
import { ResultAsync } from 'neverthrow'

export const bookGetListUsecase = async (
  repository: IBookRepository,
  searchConditions: ValidatedGetListBookSearchConditions,
  logger: ILogger,
): Promise<Result<ListData<GetBook>, OperationResult>> => {
  return ResultAsync.fromPromise(
    repository.fetchList(searchConditions),
    promiseErrorReturn(logger, ResultCodes.BOOK_LIST_FAILED),
  )
}
