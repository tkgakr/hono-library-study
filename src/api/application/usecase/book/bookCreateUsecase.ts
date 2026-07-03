import { checkBookTitleExists } from '@application/service/book/bookCheckService'
import { falsyValueCheck, promiseErrorReturn } from '@application/service/generic/utility'
import type { ValidatedCreateBook } from '@domain/model/book/book'
import { createBook } from '@domain/model/book/book'
import type { OperationResult } from '@domain/model/generic/generic'
import { ResultCodes } from '@domain/model/generic/generic'
import type { IBookRepository } from '@domain/repository/book/bookRepository'
import type { ILogger } from '@domain/service/logger/iLoggerService'
import type { Result } from 'neverthrow'
import { ok, ResultAsync } from 'neverthrow'

export const bookCreateUsecase = async (
  repository: IBookRepository,
  logger: ILogger,
  validatedEntity: ValidatedCreateBook,
): Promise<Result<boolean, OperationResult>> => {
  return ok(createBook(validatedEntity)) // ドメイン関数で保存命令を作る
    .asyncAndThrough((created) =>
      checkBookTitleExists(repository, logger, created.title),
    ) // 重複チェック（素通し）
    .andThen((created) =>
      ResultAsync.fromPromise(
        repository.save(created),
        promiseErrorReturn(logger, ResultCodes.BOOK_SAVE_FAILED),
      ),
    ) // 保存
    .andThen(falsyValueCheck(ResultCodes.BOOK_SAVE_FAILED)) // 保存結果が false なら失敗
}
