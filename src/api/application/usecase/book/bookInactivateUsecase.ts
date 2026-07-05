import { falsyValueCheck, nullOrUndefinedCheck, promiseErrorReturn } from '@application/service/generic/utility'
import { inactivateBook } from '@domain/model/book/book'
import type { OperationResult } from '@domain/model/generic/generic'
import { ResultCodes } from '@domain/model/generic/generic'
import type { IBookRepository } from '@domain/repository/book/bookRepository'
import type { ILogger } from '@domain/service/logger/iLoggerService'
import type { Result } from 'neverthrow'
import { ResultAsync } from 'neverthrow'

export const bookInactivateUsecase = async (
  repository: IBookRepository,
  logger: ILogger,
  bookId: string,
): Promise<Result<boolean, OperationResult>> => {
  return ResultAsync.fromPromise(
    repository.fetchDetail(bookId),
    promiseErrorReturn(logger, ResultCodes.BOOK_FETCH_FAILED),
  )
    .map((entity) => entity.value)
    .andThen(nullOrUndefinedCheck(ResultCodes.BOOK_NOT_FOUND))
    .andThen((entity) =>
      ResultAsync.fromPromise(
        repository.save(inactivateBook(entity.id)),
        promiseErrorReturn(logger, ResultCodes.BOOK_SAVE_FAILED),
      ),
    )
    .andThen(falsyValueCheck(ResultCodes.BOOK_SAVE_FAILED))
}
