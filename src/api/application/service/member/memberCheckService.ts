import { promiseErrorReturn } from '@application/service/generic/utility'
import { isEmptyArray, isEmptyOrWhitespaceString } from '@core/core'
import type { OperationResult } from '@domain/model/generic/generic'
import { ResultCodes } from '@domain/model/generic/generic'
import type { IMemberRepository } from '@domain/repository/member/memberRepository'
import type { ILogger } from '@domain/service/logger/iLoggerService'
import { err, okAsync, ResultAsync } from 'neverthrow'

export const checkMemberEmailExists = (
  repository: IMemberRepository,
  logger: ILogger,
  email: string,
  excludeId?: string,
): ResultAsync<void, OperationResult> => {
  // 更新時は email 未変更を空文字で受ける契約（usecase 側の `?? ''`）のため、
  // 空白ならチェック対象外としてスキップする
  return isEmptyOrWhitespaceString(email)
    ? okAsync()
    : ResultAsync.fromPromise(
        repository.findByEmail(email),
        promiseErrorReturn(logger, ResultCodes.MEMBER_DUPLICATE_CHECK_FAILED),
      ).andThen((result) =>
        // 更新/復元では自分自身を除外して判定
        isEmptyArray(excludeId ? result.value.filter((item) => item.id !== excludeId) : result.value)
          ? okAsync()
          : err({ code: ResultCodes.MEMBER_ALREADY_EXISTS }),
      )
}
