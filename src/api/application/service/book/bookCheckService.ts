import { promiseErrorReturn } from '@application/service/generic/utility'
import { isEmptyArray, isEmptyOrWhitespaceString } from '@core/core'
import type { OperationResult } from '@domain/model/generic/generic'
import { ResultCodes } from '@domain/model/generic/generic'
import type { IBookRepository } from '@domain/repository/book/bookRepository'
import type { ILogger } from '@domain/service/logger/iLoggerService'
import { err, okAsync, ResultAsync } from 'neverthrow'

export const checkBookTitleExists = (
  repository: IBookRepository,
  logger: ILogger,
  title: string,
  excludeId?: string,
): ResultAsync<void, OperationResult> => {
  // タイトル未指定（空白）なら何もチェックしない
  return isEmptyOrWhitespaceString(title)
    ? okAsync()
    : ResultAsync.fromPromise(
        repository.findByTitle(title),
        promiseErrorReturn(logger, ResultCodes.BOOK_DUPLICATE_CHECK_FAILED),
      ).andThen((result) =>
        // 更新/復元では自分自身を除外して判定
        isEmptyArray(excludeId ? result.value.filter((item) => item.id !== excludeId) : result.value)
          ? okAsync()
          : err({ code: ResultCodes.BOOK_ALREADY_EXISTS }),
      )
}
