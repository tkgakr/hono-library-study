import { checkBookTitleExists } from '@application/service/book/bookCheckService'
import { falsyValueCheck, nullOrUndefinedCheck, promiseErrorReturn } from '@application/service/generic/utility'
import { activateBook } from '@domain/model/book/book'
import type { OperationResult } from '@domain/model/generic/generic'
import { ResultCodes } from '@domain/model/generic/generic'
import type { IBookRepository } from '@domain/repository/book/bookRepository'
import type { ILogger } from '@domain/service/logger/iLoggerService'
import type { Result } from 'neverthrow'
import { err, ok, ResultAsync } from 'neverthrow'

export const bookActivateUsecase = async (
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
      entity.isActive ? err({ code: ResultCodes.BOOK_INVALID_STATE, args: { operation: '復元' } }) : ok(entity),
    ) // 既に有効ならエラー
    .andThrough((entity) => checkBookTitleExists(repository, logger, entity.title, entity.id))
    .andThen((entity) =>
      ResultAsync.fromPromise(
        repository.save(activateBook(entity.id)),
        promiseErrorReturn(logger, ResultCodes.BOOK_SAVE_FAILED),
      ),
    )
    .andThen(falsyValueCheck(ResultCodes.BOOK_SAVE_FAILED))
}
