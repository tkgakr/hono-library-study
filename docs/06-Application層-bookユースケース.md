# 06. Application層 — book ユースケース

application 層は **「処理の段取り」** を書く場所です。ビジネスルール（domain）と DB アクセス（infrastructure の契約）を組み合わせ、1つの処理を完成させます。

最大の特徴は **`neverthrow` による Result 型**。例外を投げる代わりに「成功値 or エラーコード」を値として返し、`try/catch` をほぼ書きません。

作るファイル:

```
src/api/application/
├─ service/
│  ├─ generic/utility.ts            … neverthrow 用の共通ガード
│  └─ book/bookCheckService.ts      … タイトル重複チェック
└─ usecase/book/
   ├─ bookCreateUsecase.ts
   ├─ bookGetListUsecase.ts
   ├─ bookGetDetailUsecase.ts
   ├─ bookUpdateUsecase.ts
   ├─ bookInactivateUsecase.ts
   └─ bookActivateUsecase.ts
```

> 本章では create / getList / getDetail / update / activate を解説します。inactivate は activate とほぼ同型なので章末に置きます。

---

## 0. neverthrow の最小知識

`Result<T, E>` は「成功(`Ok<T>`) か 失敗(`Err<E>`)」のどちらかを表す型です。本教材で使う主な操作:

| 関数/メソッド | 役割 |
| --- | --- |
| `ok(v)` / `err(e)` | 同期の成功 / 失敗を作る |
| `okAsync(v)` | 非同期の成功 |
| `ResultAsync.fromPromise(p, onErr)` | 生の `Promise` を Result の世界へ持ち上げる。例外時は `onErr` でエラー値に変換 |
| `.map(fn)` | 成功値を変換（失敗しない変換） |
| `.andThen(fn)` | 成功値を「失敗しうる処理」に通す（`fn` は Result を返す） |
| `.andThrough(fn)` | 副作用的なチェック。成功なら**元の値をそのまま通す**（チェックの戻り値は捨てる） |

`.andThen` は値が変わる／失敗しうる変換、`.andThrough` は「検証だけして素通し」と覚えると読みやすいです。

---

## 1. 共通ガード `service/generic/utility.ts`

Result を返す小さなチェック関数群。**コードを先に部分適用**しておき、`.andThen` / `.andThrough` の引数として差し込めるようカリー化されています。

```ts
// src/api/application/service/generic/utility.ts
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
```

---

## 2. 重複チェック `service/book/bookCheckService.ts`

「同じタイトルが既にあるか」を調べる、複数ユースケースから使う横断的なチェック。`ResultAsync<void, OperationResult>` を返し、`.andThrough` で素通しに使います。

```ts
// src/api/application/service/book/bookCheckService.ts
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
    : ResultAsync.fromPromise(repository.findByTitle(title), promiseErrorReturn(logger, ResultCodes.E0104)).andThen((result) =>
        // 更新/復元では自分自身を除外して判定
        isEmptyArray(excludeId ? result.value.filter((item) => item.id !== excludeId) : result.value)
          ? okAsync()
          : err({ code: ResultCodes.W0103 }),
      )
}
```

---

## 3. 作成 `usecase/book/bookCreateUsecase.ts`

すべてのユースケースは **`Promise<Result<T, OperationResult>>`** を返し、引数に `repository`(契約) と `logger` を受け取ります（依存を外から注入）。

```ts
// src/api/application/usecase/book/bookCreateUsecase.ts
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
    .asyncAndThrough((created) => checkBookTitleExists(repository, logger, created.title)) // 重複チェック（素通し）
    .andThen((created) => ResultAsync.fromPromise(repository.save(created), promiseErrorReturn(logger, ResultCodes.E0103))) // 保存
    .andThen(falsyValueCheck(ResultCodes.E0103)) // 保存結果が false なら失敗
}
```

流れ: `createBook()` で `CreatedBook` を作る → タイトル重複を確認（問題なければ値を素通し）→ `repository.save()` を Result に持ち上げて実行 → 保存が `false` なら `E0103`。`try/catch` は一つもありません。

---

## 4. 一覧取得 `usecase/book/bookGetListUsecase.ts`

最も単純な読み取り。リポジトリの結果をそのまま Result に持ち上げるだけ（空配列も正常）。

```ts
// src/api/application/usecase/book/bookGetListUsecase.ts
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
  return ResultAsync.fromPromise(repository.fetchList(searchConditions), promiseErrorReturn(logger, ResultCodes.E0101))
}
```

---

## 5. 詳細取得 `usecase/book/bookGetDetailUsecase.ts`

取得してから「存在チェック」を足します。`.andThrough` で `value` が null/undefined なら `W0101`（見つからない＝業務警告）。

```ts
// src/api/application/usecase/book/bookGetDetailUsecase.ts
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
  return ResultAsync.fromPromise(repository.fetchDetail(id), promiseErrorReturn(logger, ResultCodes.E0102)).andThrough((entity) =>
    nullOrUndefinedCheck(ResultCodes.W0101)(entity.value),
  )
}
```

> `E0102`（取得失敗＝システムエラー / 500）と `W0101`（見つからない＝業務警告 / 404）の **使い分け**に注目。

---

## 6. 更新 `usecase/book/bookUpdateUsecase.ts`

「取得 → 存在チェック → 状態チェック → 重複チェック → 保存」の本格的なパイプライン。

```ts
// src/api/application/usecase/book/bookUpdateUsecase.ts
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
  return ResultAsync.fromPromise(repository.fetchDetail(id), promiseErrorReturn(logger, ResultCodes.E0102))
    .map((entity) => entity.value) // EntityData の殻を外す
    .andThen(nullOrUndefinedCheck(ResultCodes.W0101)) // 存在チェック
    .andThrough((entity) => (entity.isActive ? ok(entity) : err({ code: ResultCodes.W0102, args: { operation: '更新' } }))) // 有効なものだけ更新可
    .andThrough((entity) => checkBookTitleExists(repository, logger, validatedEntity.title ?? '', entity.id)) // 自分以外との重複
    .andThen((entity) => ResultAsync.fromPromise(repository.save(updateBook(entity.id, validatedEntity)), promiseErrorReturn(logger, ResultCodes.E0103)))
    .andThen(falsyValueCheck(ResultCodes.E0103))
}
```

勘所:
- `.map((entity) => entity.value)` で `EntityData<GetBook>` の `value` を取り出す。
- 状態不変条件（無効な蔵書は更新不可）を `.andThrough` で表現。`args: { operation: '更新' }` はメッセージ生成用（07章 `setResponse` で `{operation}できません` に埋め込む）。
- 重複チェックは `excludeId = entity.id` を渡して**自分自身を除外**。

---

## 7. 復元 `usecase/book/bookActivateUsecase.ts`

更新の鏡像。状態チェックが逆（**既に有効なら復元できない**）。

```ts
// src/api/application/usecase/book/bookActivateUsecase.ts
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
  return ResultAsync.fromPromise(repository.fetchDetail(bookId), promiseErrorReturn(logger, ResultCodes.E0102))
    .map((entity) => entity.value)
    .andThen(nullOrUndefinedCheck(ResultCodes.W0101))
    .andThen((entity) => (entity.isActive ? err({ code: ResultCodes.W0102, args: { operation: '復元' } }) : ok(entity))) // 既に有効ならエラー
    .andThrough((entity) => checkBookTitleExists(repository, logger, entity.title, entity.id))
    .andThen((entity) => ResultAsync.fromPromise(repository.save(activateBook(entity.id)), promiseErrorReturn(logger, ResultCodes.E0103)))
    .andThen(falsyValueCheck(ResultCodes.E0103))
}
```

## 8. 無効化 `usecase/book/bookInactivateUsecase.ts`

論理削除。存在チェックだけして保存します（更新より単純）。

```ts
// src/api/application/usecase/book/bookInactivateUsecase.ts
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
  return ResultAsync.fromPromise(repository.fetchDetail(bookId), promiseErrorReturn(logger, ResultCodes.E0102))
    .map((entity) => entity.value)
    .andThen(nullOrUndefinedCheck(ResultCodes.W0101))
    .andThen((entity) => ResultAsync.fromPromise(repository.save(inactivateBook(entity.id)), promiseErrorReturn(logger, ResultCodes.E0103)))
    .andThen(falsyValueCheck(ResultCodes.E0103))
}
```

---

## この章のまとめ

- ユースケースは `Promise<Result<T, OperationResult>>` を返し、`repository`/`logger` を注入で受け取る（1処理1ファイル）
- `neverthrow` で例外を投げず、`ResultAsync.fromPromise` + `andThen`/`andThrough`/`map` を組み合わせる
- 共通ガード（`falsyValueCheck`/`nullOrUndefinedCheck`/`promiseErrorReturn`）と横断チェック（`checkBookTitleExists`）を差し込む
- `W`（業務警告：見つからない・状態不正・重複）と `E`（システムエラー：DB例外）を使い分ける

処理の段取りができました。あとは **これを HTTP に繋ぐ**だけです。次章の interface 層で、zod-openapi を使って入口と出口を作ります。
