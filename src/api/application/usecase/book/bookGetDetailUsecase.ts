import { nullOrUndefinedCheck, promiseErrorReturn } from '@application/service/generic/utility'
import type { GetBook } from '@domain/model/book/book'
import type { OperationResult } from '@domain/model/generic/generic'
import { ResultCodes } from '@domain/model/generic/generic'
import type { EntityData } from '@domain/model/generic/repositoryData'
import type { IBookRepository } from '@domain/repository/book/bookRepository'
import type { ILogger } from '@domain/service/logger/iLoggerService'
import type { Result } from 'neverthrow'
import { ResultAsync } from 'neverthrow'

export const bookGetDetailUsecase = async (
  id: string,
  repository: IBookRepository,
  logger: ILogger,
): Promise<Result<EntityData<GetBook>, OperationResult>> => {
  return ResultAsync.fromPromise(repository.fetchDetail(id), promiseErrorReturn(logger, ResultCodes.BOOK_FETCH_FAILED)).andThrough((entity) =>
    nullOrUndefinedCheck(ResultCodes.BOOK_NOT_FOUND)(entity.value),
  )
}
