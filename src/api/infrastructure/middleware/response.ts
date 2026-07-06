import type { OperationResult, ResultCode, ResultMessageArgs } from '@domain/model/generic/generic'
import { ResultCodes } from '@domain/model/generic/generic'
import type { EntityData, ListData } from '@domain/model/generic/repositoryData'
import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

interface ResponseMessageDefinition {
  message: (args?: ResultMessageArgs) => string
  httpStatusCode: ContentfulStatusCode
}

// 結果コードごとに「メッセージ + HTTPステータス」を定義（網羅）
export const APIResultValue: Record<ResultCode, ResponseMessageDefinition> = {
  [ResultCodes.SUCCESS]: { message: () => '正常に処理されました', httpStatusCode: 200 },
  [ResultCodes.INVALID_REQUEST_FORMAT]: { message: () => 'リクエストの形式が不正です', httpStatusCode: 400 },
  [ResultCodes.VALIDATION_FAILED]: {
    message: (a) => `リクエストパラメータが不正です（${a?.invalidParameters}）`,
    httpStatusCode: 400,
  },
  [ResultCodes.BOOK_NOT_FOUND]: { message: () => '指定された蔵書は存在しません', httpStatusCode: 404 },
  [ResultCodes.BOOK_INVALID_STATE]: { message: (a) => `${a?.operation}可能な蔵書がありません`, httpStatusCode: 404 },
  [ResultCodes.BOOK_ALREADY_EXISTS]: { message: () => '同じタイトルの蔵書が既に存在します', httpStatusCode: 400 },
  [ResultCodes.BOOK_LIST_FAILED]: { message: () => '蔵書の一覧取得に失敗しました', httpStatusCode: 500 },
  [ResultCodes.BOOK_FETCH_FAILED]: { message: () => '蔵書の取得に失敗しました', httpStatusCode: 500 },
  [ResultCodes.BOOK_SAVE_FAILED]: { message: () => '蔵書の保存に失敗しました', httpStatusCode: 500 },
  [ResultCodes.BOOK_DUPLICATE_CHECK_FAILED]: { message: () => '蔵書の取得に失敗しました', httpStatusCode: 500 },
  [ResultCodes.INTERNAL_ERROR]: { message: () => '内部エラーが発生しました', httpStatusCode: 500 },
}

export const setResponse = <T>(
  context: Context,
  operationResult: OperationResult,
  data?: EntityData<T> | ListData<T>,
): Response => {
  const apiResult = APIResultValue[operationResult.code]
  return context.json(
    {
      apiStatus: {
        code: operationResult.code,
        message: apiResult.message(operationResult.args),
      },
      data,
    },
    apiResult.httpStatusCode,
  )
}
