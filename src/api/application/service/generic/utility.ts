import type { OperationResult, ResultCode } from '@domain/model/generic/generic'
import type { ILogger } from '@domain/service/logger/iLoggerService'
import type { Result } from 'neverthrow'
import { err, ok } from 'neverthrow'

// falsy ならエラー
export const falsyValueCheck =
  (code: ResultCode) =>
  <T>(value: T): Result<T, OperationResult> =>
    value ? ok(value) : err({ code })

// null/undefined ならエラー
export const nullOrUndefinedCheck =
  (code: ResultCode) =>
  <T>(value: T | null | undefined): Result<T, OperationResult> =>
    value == null ? err({ code }) : ok(value)

// Promise が例外を投げたときの変換（ログを出してエラーコードに）
export const promiseErrorReturn =
  (logger: ILogger, code: ResultCode) =>
  (error: unknown): OperationResult => {
    logger.error((error as Error).message)
    return { code }
  }
