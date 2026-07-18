# 04. Domain層 — book モデル

ここから図書館の最初のエンティティ **`book`（蔵書）** を、一番内側の **domain 層**から作ります。domain 層は「ビジネスのルールと型」だけを持ち、DB も HTTP も知りません。

`book` の仕様（CRUD + 論理削除/復元を持つ最小形）:

| フィールド | 型 | 説明 |
| --- | --- | --- |
| `id` | uuid | 主キー |
| `title` | 非空文字列 | 書名 |
| `author` | 非空文字列 | 著者 |
| `isActive` | boolean | 有効フラグ（論理削除に使う） |

操作は **作成 / 更新 / 無効化(論理削除) / 復元** の4つ。`title` は重複禁止にします。

作るファイル:

```
src/api/domain/
├─ model/
│  ├─ generic/
│  │  ├─ commonSchema.ts        … 共通スキーマ（非空文字列）
│  │  ├─ generic.ts             … ResultCodes / OperationResult
│  │  ├─ repositoryData.ts      … ListData / EntityData
│  │  └─ searchCondition.ts     … paging / sort の共通型
│  └─ book/
│     ├─ book.ts                … book のスキーマとドメイン関数
│     └─ bookSearchConditions.ts… 一覧検索条件
└─ repository/book/bookRepository.ts … リポジトリ interface
```

---

## 1. 共通スキーマ `generic/commonSchema.ts`

「空白だけはダメな文字列」を**一箇所**で定義し、各モデルから使い回します（毎回ローカル定義しないのが定石）。

```ts
// src/api/domain/model/generic/commonSchema.ts
import z from 'zod'

export const notBlankStringSchema = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0, {
    message: '空白文字のみは指定できません',
  })
```

---

## 2. 結果コード `generic/generic.ts`

成功・警告・エラーを表す**コードの一覧**です。`as const` オブジェクトから型を導出するイディオム（`(typeof X)[keyof typeof X]`）で、値（実行時）と型（コンパイル時）を一度に得ます。

コード体系は `{ステータス I/W/E}{機能2桁}{連番2桁}` とします。図書館では book = `01`、member = `02`、loan = `03` を割り当て、`99` は機能横断の汎用コードに予約します。キーは `{機能}_{内容}` の SCREAMING_SNAKE_CASE（意味値）とし、コード値は値側に持たせます。

```ts
// src/api/domain/model/generic/generic.ts
export const ResultCodes = {
  // 正常
  SUCCESS: 'I0000', // 成功

  // 警告（業務的な失敗：見つからない・状態不正・重複など）
  // book
  BOOK_NOT_FOUND: 'W0101', // 指定の蔵書が存在しない
  BOOK_INVALID_STATE: 'W0102', // 操作可能な状態でない
  BOOK_ALREADY_EXISTS: 'W0103', // 同名の蔵書が既に存在する
  // generic
  INVALID_REQUEST_FORMAT: 'W9900', // リクエストフォーマットエラー
  VALIDATION_FAILED: 'W9901', // バリデーションエラー

  // エラー（システム的な失敗：DB 例外など）
  // book
  BOOK_LIST_FAILED: 'E0101', // 一覧取得失敗
  BOOK_FETCH_FAILED: 'E0102', // 取得失敗
  BOOK_SAVE_FAILED: 'E0103', // 保存失敗
  BOOK_DUPLICATE_CHECK_FAILED: 'E0104', // 重複チェック失敗
  // generic
  INTERNAL_ERROR: 'E9999', // 内部エラー
} as const
export type ResultCode = (typeof ResultCodes)[keyof typeof ResultCodes]

// メッセージに埋め込む引数のキー（例: 「{operation}できません」）
export const ResultMessageArgKeys = {
  OPERATION: 'operation',
  INVALID_PARAMETERS: 'invalidParameters',
} as const
export type ResultMessageArgKey = (typeof ResultMessageArgKeys)[keyof typeof ResultMessageArgKeys]
export type ResultMessageArgs = Partial<Record<ResultMessageArgKey, string>>

// application 層が返す「エラーの中身」
export interface OperationResult {
  code: ResultCode
  args?: ResultMessageArgs
}
```

> `W`(warning) と `E`(error) を分けるのが肝です。`W` は「ユーザーの操作起因の業務エラー（404/400 相当）」、`E` は「システム障害（500 相当）」。HTTP ステータスへの対応付けは interface 層（07章 `setResponse`）で行います。

---

## 3. リポジトリの戻り値の型 `generic/repositoryData.ts`

一覧（件数つき）と単体（null 許容）を表す汎用の入れ物です。

```ts
// src/api/domain/model/generic/repositoryData.ts
export interface ListData<T> {
  value: T[]
  total: number
}

export interface EntityData<T> {
  value: T | null
}
```

## 4. 検索条件の共通部品 `generic/searchCondition.ts`

ページングとソートはどのエンティティでも共通なので、汎用の branded スキーマにしておきます。

```ts
// src/api/domain/model/generic/searchCondition.ts
import z from 'zod'

export const validatedSearchConditionPagingSchema = z
  .object({
    limit: z.int().min(1).optional(),
    offset: z.int().min(0).optional(),
  })
  .brand<'ValidatedSearchConditionPaging'>()
export type ValidatedSearchConditionPaging = z.infer<typeof validatedSearchConditionPagingSchema>

export const validatedSearchConditionSortItemSchema = z
  .object({
    column: z.string(),
    order: z.enum(['asc', 'desc']),
  })
  .brand<'ValidatedSearchConditionSortItem'>()
export type ValidatedSearchConditionSortItem = z.infer<typeof validatedSearchConditionSortItemSchema>

export const validatedSearchConditionSortSchema = z
  .object({ orderBy: z.array(validatedSearchConditionSortItemSchema) })
  .brand<'ValidatedSearchConditionSort'>()
export type ValidatedSearchConditionSort = z.infer<typeof validatedSearchConditionSortSchema>
```

### `.brand<'...'>()` とは？

zod の **ブランド型**です。中身が同じ `{ limit, offset }` でも、ブランドが違えば TypeScript 上は**別の型**として扱われます。これにより「検証前の生データ」と「検証済みのドメイン値」を取り違えるミスをコンパイル時に防げます。本教材では各層の型境界でこの手法を活用します。

---

## 5. book のドメインモデル `book/book.ts`

ここが domain 層の中心です。順に読み解きます。

```ts
// src/api/domain/model/book/book.ts
import { notBlankStringSchema } from '@domain/model/generic/commonSchema'
import z from 'zod'

// (A) 操作種別を const で定義し、型は typeof から参照する
export const bookSaveOperations = {
  CREATE: 'create',
  UPDATE: 'update',
  INACTIVATE: 'inactivate',
  ACTIVATE: 'activate',
} as const

// (B) 取得用スキーマ（DB から読み出した1件を表す）
export const getBookSchema = z
  .object({
    id: z.uuid(),
    title: notBlankStringSchema,
    author: notBlankStringSchema,
    isActive: z.boolean(),
  })
  .brand<'GetBook'>()
export type GetBook = z.infer<typeof getBookSchema>

// (C) 作成：入力（検証済み）→ ドメイン関数 → コマンド型
export const validatedCreateBookSchema = z
  .object({
    title: notBlankStringSchema,
    author: notBlankStringSchema,
  })
  .brand<'ValidatedCreateBook'>()
export type ValidatedCreateBook = z.infer<typeof validatedCreateBookSchema>

export const createdBookSchema = z
  .object({
    operation: z.literal(bookSaveOperations.CREATE),
    id: z.uuid(),
    title: notBlankStringSchema,
    author: notBlankStringSchema,
  })
  .brand<'CreatedBook'>()
export type CreatedBook = z.infer<typeof createdBookSchema>

export const createBook = (entity: ValidatedCreateBook): CreatedBook =>
  createdBookSchema.parse({
    operation: bookSaveOperations.CREATE,
    id: crypto.randomUUID(), // (D) ID採番は domain の create で行う
    title: entity.title,
    author: entity.author,
  })

// (E) 更新：どちらか必須を refine で表現
export const validatedUpdateBookSchema = z
  .object({
    title: notBlankStringSchema.optional(),
    author: notBlankStringSchema.optional(),
  })
  .refine((data) => data.title !== undefined || data.author !== undefined, {
    message: 'title または author のどちらかを指定してください',
  })
  .brand<'ValidatedUpdateBook'>()
export type ValidatedUpdateBook = z.infer<typeof validatedUpdateBookSchema>

export const updatedBookSchema = z
  .object({
    operation: z.literal(bookSaveOperations.UPDATE),
    id: z.uuid(),
    title: notBlankStringSchema.optional(),
    author: notBlankStringSchema.optional(),
  })
  .brand<'UpdatedBook'>()
export type UpdatedBook = z.infer<typeof updatedBookSchema>

export const updateBook = (id: string, entity: ValidatedUpdateBook): UpdatedBook =>
  updatedBookSchema.parse({
    operation: bookSaveOperations.UPDATE,
    id,
    title: entity.title,
    author: entity.author,
  })

// (F) 無効化（論理削除）
export const inactivatedBookSchema = z
  .object({
    operation: z.literal(bookSaveOperations.INACTIVATE),
    id: z.uuid(),
    isActive: z.literal(false),
  })
  .brand<'InactivatedBook'>()
export type InactivatedBook = z.infer<typeof inactivatedBookSchema>

export const inactivateBook = (id: string): InactivatedBook =>
  inactivatedBookSchema.parse({
    operation: bookSaveOperations.INACTIVATE,
    id,
    isActive: false,
  })

// (G) 復元
export const activatedBookSchema = z
  .object({
    operation: z.literal(bookSaveOperations.ACTIVATE),
    id: z.uuid(),
    isActive: z.literal(true),
  })
  .brand<'ActivatedBook'>()
export type ActivatedBook = z.infer<typeof activatedBookSchema>

export const activateBook = (id: string): ActivatedBook =>
  activatedBookSchema.parse({
    operation: bookSaveOperations.ACTIVATE,
    id,
    isActive: true,
  })

// (H) 保存系コマンドの直和型（discriminated union）
export type SaveBook = CreatedBook | UpdatedBook | InactivatedBook | ActivatedBook
```

### 読み解きの勘所

- **(A) 操作種別は `as const` の定数で持つ**。型は `typeof bookSaveOperations.CREATE` のように参照。マジック文字列を散らさない。
- **(C)(D) 「入力型 → ドメイン関数 → コマンド型」の3点セット**。`Validated*`（検証済み入力）を受け取り、`create*` 関数の中で最終的に `*Schema.parse()` を通して `Created*`（保存命令）を作る。ID はここで `crypto.randomUUID()` で採番する。
- **(E) ビジネスルールは `refine` で表現**。更新は「title か author の少なくとも一方が必要」。
- **(H) discriminated union**。`operation` フィールドで4種の保存命令を1つの型に束ねる。リポジトリの `save` はこの `SaveBook` 1つを受け取り、`operation` で分岐する（05章）。

接頭辞の使い分け（命名規則）:

| 接頭辞 | 意味 |
| --- | --- |
| `Get...` | DB から取得した1件 |
| `Validated...` | 検証済みの入力 |
| `Created/Updated/Inactivated/Activated...` | 永続化する保存命令 |

---

## 6. 一覧検索条件 `book/bookSearchConditions.ts`

book 固有のフィルタ（`title` / 簡易検索 / `isActive`）を、共通の paging・sort と合成します。

```ts
// src/api/domain/model/book/bookSearchConditions.ts
import { validatedSearchConditionPagingSchema, validatedSearchConditionSortSchema } from '@domain/model/generic/searchCondition'
import z from 'zod'

const validatedGetListBookParametersSchema = z.object({
  title: z.string().optional(),
  searchFilter: z.string().optional(),
  isActive: z.boolean().optional(),
})
export type ValidatedGetListBookParameters = z.infer<typeof validatedGetListBookParametersSchema>

export const validatedGetListBookSearchConditionsSchema = z
  .object({
    parameters: validatedGetListBookParametersSchema.optional(),
    paging: validatedSearchConditionPagingSchema,
    sort: validatedSearchConditionSortSchema,
  })
  .brand<'ValidatedGetListBookSearchConditions'>()
export type ValidatedGetListBookSearchConditions = z.infer<typeof validatedGetListBookSearchConditionsSchema>
```

---

## 7. リポジトリの契約 `repository/book/bookRepository.ts`

domain 層に **インターフェースだけ**を置きます（実装は infrastructure 層・05章）。これが依存性逆転の境界です。domain の型しか登場しないことに注目してください。

```ts
// src/api/domain/repository/book/bookRepository.ts
import type { GetBook, SaveBook } from '@domain/model/book/book'
import type { ValidatedGetListBookSearchConditions } from '@domain/model/book/bookSearchConditions'
import type { EntityData, ListData } from '@domain/model/generic/repositoryData'

export interface IBookRepository {
  fetchList: (searchConditions: ValidatedGetListBookSearchConditions) => Promise<ListData<GetBook>>
  fetchDetail: (id: string) => Promise<EntityData<GetBook>>
  save: (command: SaveBook) => Promise<boolean>
  findByTitle: (title: string) => Promise<ListData<GetBook>>
}
```

> マルチテナント構成では各メソッドの第1引数に `tenantId` を取ることがありますが、本教材では外しています。`save` が `SaveBook`（直和型）1つを受け取り、4操作すべてを1メソッドで扱う設計は変わりません。

---

## この章のまとめ

- `notBlankStringSchema` … 共通の非空文字列
- `ResultCodes` / `OperationResult` … 結果コード（W=業務エラー / E=システムエラー）
- `.brand<>()` … 中身が同じでも型を別物にして取り違えを防ぐ
- book モデル … 「入力型 → ドメイン関数 → コマンド型」の3点セット、`refine` でルール、`SaveBook` 直和型
- `IBookRepository` … domain に置く契約（実装は外側）

ここまでは **DB も HTTP も一切登場していません**。これが「純粋な内側」です。次章ではこの契約 `IBookRepository` を、Drizzle で実装します。
