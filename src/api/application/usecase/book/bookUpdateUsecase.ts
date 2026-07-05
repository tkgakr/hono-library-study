import { checkBookTitleExists } from '@application/service/book/bookCheckService'
import { falsyValueCheck, nullOrUndefinedCheck, promiseErrorReturn } from '@application/service/generic/utility'
import type { ValidatedUpdateBook } from '@domain/model/book/book'
import { updateBook } from '@domain/model/book/book'
import type { OperationResult } from '@domain/model/generic/generic'
import { ResultCodes } from '@domain/model/generic/generic'
import type { IBookRepository } from '@domain/repository/book/bookRepository'
import type { ILogger } from '@domain/service/logger/iLoggerService'
import type { Result } from 'neverthrow'
import { err, ok, ResultAsync } from 'neverthrow'

export const bookUpdateUsecase = async (
  repository: IBookRepository,
  logger: ILogger,
  id: string,
  validatedEntity: ValidatedUpdateBook,
): Promise<Result<boolean, OperationResult>> => {
  return ResultAsync.fromPromise(repository.fetchDetail(id), promiseErrorReturn(logger, ResultCodes.BOOK_FETCH_FAILED))
    .map((entity) => entity.value) // EntityData の殻を外す
    .andThen(nullOrUndefinedCheck(ResultCodes.BOOK_NOT_FOUND)) // 存在チェック
    .andThrough((entity) =>
      entity.isActive ? ok(entity) : err({ code: ResultCodes.BOOK_INVALID_STATE, args: { operation: '更新' } }),
    ) // 有効なものだけ更新可
    .andThrough((entity) => checkBookTitleExists(repository, logger, validatedEntity.title ?? '', entity.id)) // 自分以外との重複
    .andThen((entity) =>
      ResultAsync.fromPromise(
        repository.save(updateBook(entity.id, validatedEntity)),
        promiseErrorReturn(logger, ResultCodes.BOOK_SAVE_FAILED),
      ),
    )
    .andThen(falsyValueCheck(ResultCodes.BOOK_SAVE_FAILED))
}
