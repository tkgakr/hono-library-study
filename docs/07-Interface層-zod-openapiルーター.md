# 07. Interface層 — zod-openapi ルーター

このプロジェクトの**本題**です。`@hono/zod-openapi` を使って、HTTP の入口（リクエスト検証）と出口（レスポンス整形 + OpenAPI ドキュメント）を作ります。ここまで作った usecase を呼び出し、book の CRUD を外から叩けるようにします。

作るファイル:

```
src/api/
├─ infrastructure/middleware/
│  ├─ response.ts             … setResponse（統一レスポンス整形）
│  ├─ errorHandler.ts         … 例外を統一形式に変換
│  └─ honoOpenApiFactory.ts   … defaultHook 入りの OpenAPIHono 生成
├─ interface/
│  ├─ model/
│  │  ├─ generic.ts           … 共通スキーマ（envelope / paging / sort 変換）
│  │  └─ book.ts              … unValidated スキーマ + validate 関数
│  ├─ router/
│  │  ├─ genericRouter.ts     … 共通の params / responses
│  │  └─ bookRouter.ts        … book のルート定義
│  └─ routerIndex.ts          … ルート集約
└─ serverIndex.ts             … 01章の最小版を本実装に差し替え
```

---

## zod-openapi の核心（最初に全体像）

`@hono/zod-openapi` では、エンドポイント1本を次の2ステップで作ります。

```ts
// (1) createRoute で「仕様」を宣言する（パス・メソッド・入力スキーマ・出力スキーマ）
const route = createRoute({ method, path, request: {...}, responses: {...} })

// (2) app.openapi(route, handler) で「実装」を結びつける
app.openapi(route, (c) => { ... })
```

宣言したスキーマで **リクエストが自動検証**され、同時に **OpenAPI ドキュメント（/json → Swagger UI）も自動生成**されます。素の Hono の `app.get('/', handler)` との最大の違いがこれです。

ハンドラ内では検証済みの値を `c.req.valid('param' | 'query' | 'json')` で取り出します。

---

## 1. 統一レスポンス `middleware/response.ts`

全ハンドラとエラーハンドラが使う、ただ1つのレスポンス整形関数です。結果コード → 日本語メッセージ + HTTP ステータスの対応表を持ち、固定エンベロープ `{ apiStatus, data }` で返します。

```ts
// src/api/infrastructure/middleware/response.ts
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
  [ResultCodes.I0000]: { message: () => '正常に処理されました', httpStatusCode: 200 },
  [ResultCodes.W9900]: { message: () => 'リクエストの形式が不正です', httpStatusCode: 400 },
  [ResultCodes.W9901]: { message: (a) => `リクエストパラメータが不正です（${a?.invalidParameters}）`, httpStatusCode: 400 },
  [ResultCodes.W0101]: { message: () => '指定された蔵書は存在しません', httpStatusCode: 404 },
  [ResultCodes.W0102]: { message: (a) => `${a?.operation}可能な蔵書がありません`, httpStatusCode: 404 },
  [ResultCodes.W0103]: { message: () => '同じタイトルの蔵書が既に存在します', httpStatusCode: 400 },
  [ResultCodes.E0101]: { message: () => '蔵書の一覧取得に失敗しました', httpStatusCode: 500 },
  [ResultCodes.E0102]: { message: () => '蔵書の取得に失敗しました', httpStatusCode: 500 },
  [ResultCodes.E0103]: { message: () => '蔵書の保存に失敗しました', httpStatusCode: 500 },
  [ResultCodes.E0104]: { message: () => '蔵書の取得に失敗しました', httpStatusCode: 500 },
  [ResultCodes.E9999]: { message: () => '内部エラーが発生しました', httpStatusCode: 500 },
}

export const setResponse = <T>(context: Context, operationResult: OperationResult, data?: EntityData<T> | ListData<T>): Response => {
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
```

> 実務では `code` を `pathCode-methodCode-resultCode`（例 `01-03-I0000`）のような複合コードにすることがあります。本教材は単純化して `resultCode` だけにしています（複合コードの仕組みは11章で補足）。

---

## 2. 例外の捕捉 `middleware/errorHandler.ts`

interface 層の `validate...()` が投げる `ZodError` などを、`setResponse` の統一形式に変換します。Hono の `app.onError` に登録します。

```ts
// src/api/infrastructure/middleware/errorHandler.ts
import { ResultCodes } from '@domain/model/generic/generic'
import { setResponse } from '@infrastructure/middleware/response'
import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import z from 'zod'

export const globalErrorHandler = (err: Error, c: Context): Response => {
  if (err instanceof z.ZodError) {
    return setResponse(c, { code: ResultCodes.W9901, args: { invalidParameters: getZodErrorPathStrings(err) } })
  }
  if (err.message === 'Malformed JSON in request body') {
    return setResponse(c, { code: ResultCodes.W9900 })
  }
  if (err instanceof HTTPException) {
    return err.getResponse()
  }
  return setResponse(c, { code: ResultCodes.E9999 })
}

// ZodError から「どの項目が不正か」を文字列化する
export const getZodErrorPathStrings = (error: z.ZodError) =>
  error.issues.map((issue) => issue.path.join('.')).join(', ')
```

## 3. OpenAPIHono ファクトリ `middleware/honoOpenApiFactory.ts`

各ルーターは素の `new OpenAPIHono()` ではなく、このファクトリ経由で作ります。`createRoute` に宣言したスキーマの**自動検証が失敗したとき**の挙動（`defaultHook`）を全ルーター共通で仕込むためです。

```ts
// src/api/infrastructure/middleware/honoOpenApiFactory.ts
import { ResultCodes } from '@domain/model/generic/generic'
import { OpenAPIHono } from '@hono/zod-openapi'
import { getZodErrorPathStrings } from '@infrastructure/middleware/errorHandler'
import { setResponse } from '@infrastructure/middleware/response'
import type { Env } from 'hono'

export const createOpenApiHono = <E extends Env = Env>() =>
  new OpenAPIHono<E>({
    defaultHook: (result, c) => {
      if (!result.success) {
        return setResponse(c, { code: ResultCodes.W9901, args: { invalidParameters: getZodErrorPathStrings(result.error) } })
      }
    },
  })
```

> **バリデーションが2段ある**話（02章）の実体がこれです。
> - 1段目: `createRoute` の `request` スキーマ違反 → この `defaultHook` が捕捉
> - 2段目: `validate...()` 内の `domain スキーマ.parse()` の `ZodError` → `globalErrorHandler` が捕捉

---

## 4. interface 共通スキーマ `interface/model/generic.ts`

レスポンスのエンベロープ生成と、URL クエリ（ページング・ソート）を domain 用に変換するヘルパです。**`z` は `@hono/zod-openapi` から import** する点に注意（`.openapi()` メソッドが生える）。

```ts
// src/api/interface/model/generic.ts
import { z } from '@hono/zod-openapi'

export const httpStatusCodes = {
  OK: 200,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
} as const
export type HTTPStatusCode = (typeof httpStatusCodes)[keyof typeof httpStatusCodes]

export const apiStatusSchema = z.object({
  code: z.string().openapi({ example: 'I0000' }),
  message: z.string().openapi({ example: '' }),
})

// ステータスのみ（作成・更新・削除の応答）
export const statusResultSchema = z.object({ apiStatus: apiStatusSchema })

// 単体取得の応答 envelope を作る factory
export const entityResultSchema = <T extends z.ZodRawShape>(schema: z.ZodObject<T>) =>
  z.object({ apiStatus: apiStatusSchema, data: z.object({ value: schema }) })

// 一覧取得の応答 envelope を作る factory
export const listResultSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({ apiStatus: apiStatusSchema, data: z.object({ value: z.array(dataSchema), total: z.int().openapi({ example: 0 }) }) })

// --- URL クエリのページング ---
export const unValidatedSearchConditionPagingUrlQuerySchema = z.object({
  page: z.string().optional().openapi({ example: '1' }),
  'items-per-page': z.string().optional().openapi({ example: '10' }),
})
type UnValidatedPagingQuery = z.infer<typeof unValidatedSearchConditionPagingUrlQuerySchema>

export type UnValidatedUrlQueryParameter = Record<string, unknown>
export const convertSearchConditionPagingUrlQueryToParameters = (query: UnValidatedPagingQuery): UnValidatedUrlQueryParameter => {
  const itemsPerPage = query['items-per-page'] ?? null
  const page = query.page ?? '1'
  return {
    limit: itemsPerPage ? parseInt(itemsPerPage, 10) : undefined,
    offset: itemsPerPage ? (parseInt(page, 10) - 1) * parseInt(itemsPerPage, 10) : 0,
  }
}

// --- URL クエリのソート ---
const sortTypeSchema = z.enum(['asc', 'desc'])
export const unValidatedSearchConditionSortUrlQuerySchema = z.object({
  attr: z
    .union([z.string(), z.array(z.string())])
    .transform((v) => (Array.isArray(v) ? v : [v]))
    .optional()
    .openapi({ description: 'カラム名', example: ['title'], type: 'array', items: { type: 'string' } }),
  sort: z
    .union([sortTypeSchema, z.array(sortTypeSchema)])
    .transform((v) => (Array.isArray(v) ? v : [v]))
    .optional()
    .openapi({ description: 'ソート順', example: ['asc'], type: 'array', items: { type: 'string' } }),
})
type UnValidatedSortQuery = z.infer<typeof unValidatedSearchConditionSortUrlQuerySchema>

// クエリのカラム名 → DB スキーマのカラム名 のマッピング
export type SortableColumnMap = Record<string, string>
export type DefaultSortItem = { column: string; order: 'asc' | 'desc' }

export const convertSearchConditionSortUrlQueryToParameters = (
  query: UnValidatedSortQuery,
  sortableColumns: SortableColumnMap,
  defaultSortItems: DefaultSortItem[],
): UnValidatedUrlQueryParameter => {
  const attrs = query.attr ?? []
  const sorts = query.sort ?? []
  const orderBy: DefaultSortItem[] = []
  attrs.forEach((attr, index) => {
    const column = sortableColumns[attr]
    if (column && sorts[index]) orderBy.push({ column, order: sorts[index] })
  })
  defaultSortItems.forEach((item) => {
    if (!orderBy.some((o) => o.column === item.column)) orderBy.push(item)
  })
  return { orderBy }
}
```

ポイント:
- **`.openapi({ description, example })`** … スキーマにドキュメント用メタ情報を付ける。これが Swagger UI に反映される。
- `entityResultSchema` / `listResultSchema` … ペイロードを共通エンベロープで包む **schema factory**。`createRoute` の `responses` にそのまま渡す。
- ページング/ソート変換 … 文字列の URL クエリ（`page`/`items-per-page`、繰り返し可能な `attr`/`sort`）を DB 用の `{ limit, offset, orderBy }` に変換。

---

## 5. book の入力スキーマと変換 `interface/model/book.ts`

interface 層の肝、**2段階バリデーション**です。`unValidated*` で「生の HTTP の形」を受け、`validate*` で domain の検証済み型へ変換します。

```ts
// src/api/interface/model/book.ts
import type { ValidatedCreateBook, ValidatedUpdateBook } from '@domain/model/book/book'
import { validatedCreateBookSchema, validatedUpdateBookSchema } from '@domain/model/book/book'
import type { ValidatedGetListBookSearchConditions } from '@domain/model/book/bookSearchConditions'
import { validatedGetListBookSearchConditionsSchema } from '@domain/model/book/bookSearchConditions'
import { z } from '@hono/zod-openapi'
import type { DefaultSortItem, SortableColumnMap } from '@interface/model/generic'
import {
  convertSearchConditionPagingUrlQueryToParameters,
  convertSearchConditionSortUrlQueryToParameters,
  unValidatedSearchConditionPagingUrlQuerySchema,
  unValidatedSearchConditionSortUrlQuerySchema,
} from '@interface/model/generic'

// --- 一覧取得の URL クエリ ---
export const unValidatedGetListBookUrlQuerySchema = z
  .object({
    title: z.string().optional().openapi({ description: 'タイトル', example: '吾輩は猫である' }),
    'search-filter': z.string().optional().openapi({ description: '簡易検索（title/author 対象）', example: '猫' }),
    'is-active': z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => (v == null ? undefined : v === 'true'))
      .openapi({ description: '有効フラグ', example: 'true' }),
  })
  .extend(unValidatedSearchConditionPagingUrlQuerySchema.shape)
  .extend(unValidatedSearchConditionSortUrlQuerySchema.shape)
  .brand<'UnValidatedGetListBookUrlQuery'>()
export type UnValidatedGetListBookUrlQuery = z.infer<typeof unValidatedGetListBookUrlQuerySchema>

const sortableColumnMap: SortableColumnMap = { title: 'title' }
const defaultSort: DefaultSortItem[] = [{ column: 'created_at', order: 'asc' }]

export const validateGetListBookUrlQuery = (query: UnValidatedGetListBookUrlQuery): ValidatedGetListBookSearchConditions =>
  validatedGetListBookSearchConditionsSchema.parse({
    parameters: { title: query.title, searchFilter: query['search-filter'], isActive: query['is-active'] },
    paging: convertSearchConditionPagingUrlQueryToParameters(query),
    sort: convertSearchConditionSortUrlQueryToParameters(query, sortableColumnMap, defaultSort),
  })

// --- 作成 ---
export const unValidatedCreateBookSchema = z
  .object({
    title: z.string().min(1).openapi({ description: 'タイトル', example: '吾輩は猫である' }),
    author: z.string().min(1).openapi({ description: '著者', example: '夏目漱石' }),
  })
  .brand<'UnValidatedCreateBook'>()
export type UnValidatedCreateBook = z.infer<typeof unValidatedCreateBookSchema>

export const validateCreateBook = (request: UnValidatedCreateBook): ValidatedCreateBook => validatedCreateBookSchema.parse(request)

// --- 更新 ---
export const unValidatedUpdateBookSchema = z
  .object({
    title: z.string().min(1).optional().openapi({ description: 'タイトル', example: '吾輩は猫である' }),
    author: z.string().min(1).optional().openapi({ description: '著者', example: '夏目漱石' }),
  })
  .brand<'UnValidatedUpdateBook'>()
export type UnValidatedUpdateBook = z.infer<typeof unValidatedUpdateBookSchema>

export const validateUpdateBook = (request: UnValidatedUpdateBook): ValidatedUpdateBook => validatedUpdateBookSchema.parse(request)
```

ポイント:
- `unValidated*` は **kebab-case のクエリキー**（`search-filter`, `is-active`）や **文字列の enum** など「HTTP 生の形」を受ける。`.brand<>()` で検証済み型と区別。
- `validate*()` が **interface と domain の継ぎ目**。kebab → camel への詰め替え、ページング/ソート変換を行い、最後に `domain の validated*Schema.parse()` を呼ぶ。ここで失敗すると `ZodError` → `globalErrorHandler` → `W9901`。
- `is-active` の `.transform()` は文字列 `'true'` を boolean へ変換する例。

---

## 6. ルート共通部品 `interface/router/genericRouter.ts`

全ルートで使い回す params と、標準レスポンス（400/404/500）の定義です。

```ts
// src/api/interface/router/genericRouter.ts
import type { RouteConfig } from '@hono/zod-openapi'
import { z } from '@hono/zod-openapi'
import type { HTTPStatusCode } from '@interface/model/generic'
import { apiStatusSchema, httpStatusCodes } from '@interface/model/generic'

export const idRequestParams = z.object({
  id: z.uuid().openapi({ example: '123e4567-e89b-12d3-a456-426614174000' }),
})

// 各ルートが spread して使う、共通のエラーレスポンス定義
export const genericResponse: Pick<RouteConfig['responses'], HTTPStatusCode> = {
  [httpStatusCodes.BAD_REQUEST]: {
    content: { 'application/json': { schema: apiStatusSchema, example: { apiStatus: { code: 'W9901', message: 'パラメータが不正です' } } } },
    description: 'リクエストエラー(Bad Request)',
  },
  [httpStatusCodes.NOT_FOUND]: {
    content: { 'application/json': { schema: apiStatusSchema, example: { apiStatus: { code: 'W0101', message: 'リソースが見つかりません' } } } },
    description: 'リソースが見つかりません(Not Found)',
  },
  [httpStatusCodes.INTERNAL_SERVER_ERROR]: {
    content: { 'application/json': { schema: apiStatusSchema, example: { apiStatus: { code: 'E9999', message: '内部エラー' } } } },
    description: '内部エラー(Internal Server Error)',
  },
}

export const resultExamples = {
  status: { apiStatus: { code: 'I0000', message: '' } },
} as const
```

---

## 7. book ルーター `interface/router/bookRouter.ts`

ここで全部が繋がります。各エンドポイントは `createRoute`（仕様）→ `route.openapi`（実装）のペア。ハンドラの形は全 CRUD で統一されています。

```ts
// src/api/interface/router/bookRouter.ts
import { bookActivateUsecase } from '@application/usecase/book/bookActivateUsecase'
import { bookCreateUsecase } from '@application/usecase/book/bookCreateUsecase'
import { bookGetDetailUsecase } from '@application/usecase/book/bookGetDetailUsecase'
import { bookGetListUsecase } from '@application/usecase/book/bookGetListUsecase'
import { bookInactivateUsecase } from '@application/usecase/book/bookInactivateUsecase'
import { bookUpdateUsecase } from '@application/usecase/book/bookUpdateUsecase'
import { getBookSchema } from '@domain/model/book/book'
import { ResultCodes } from '@domain/model/generic/generic'
import { createRoute } from '@hono/zod-openapi'
import bookRepository from '@infrastructure/database/repository/bookRepository'
import { textLogger } from '@infrastructure/logger/logger'
import { createOpenApiHono } from '@infrastructure/middleware/honoOpenApiFactory'
import { setResponse } from '@infrastructure/middleware/response'
import {
  unValidatedCreateBookSchema,
  unValidatedGetListBookUrlQuerySchema,
  unValidatedUpdateBookSchema,
  validateCreateBook,
  validateGetListBookUrlQuery,
  validateUpdateBook,
} from '@interface/model/book'
import { entityResultSchema, httpStatusCodes, listResultSchema, statusResultSchema } from '@interface/model/generic'
import { genericResponse, idRequestParams, resultExamples } from '@interface/router/genericRouter'

export const bookRoute = createOpenApiHono()

// --- 一覧取得 GET /books ---
const getListBookRoute = createRoute({
  path: '/',
  method: 'get',
  description: '蔵書一覧取得',
  tags: ['蔵書'],
  request: { query: unValidatedGetListBookUrlQuerySchema },
  responses: {
    ...genericResponse,
    [httpStatusCodes.OK]: {
      content: { 'application/json': { schema: listResultSchema(getBookSchema) } },
      description: '蔵書一覧取得成功',
    },
  },
})
bookRoute.openapi(getListBookRoute, async (c) => {
  const searchCondition = validateGetListBookUrlQuery(c.req.valid('query'))
  const result = await bookGetListUsecase(bookRepository, searchCondition, textLogger)
  return result.isOk() ? setResponse(c, { code: ResultCodes.I0000 }, result.value) : setResponse(c, result.error)
})

// --- 詳細取得 GET /books/{id} ---
const getDetailBookRoute = createRoute({
  path: '/{id}',
  method: 'get',
  description: '蔵書詳細取得',
  tags: ['蔵書'],
  request: { params: idRequestParams },
  responses: {
    ...genericResponse,
    [httpStatusCodes.OK]: {
      content: { 'application/json': { schema: entityResultSchema(getBookSchema) } },
      description: '蔵書詳細取得成功',
    },
  },
})
bookRoute.openapi(getDetailBookRoute, async (c) => {
  const result = await bookGetDetailUsecase(c.req.valid('param').id, bookRepository, textLogger)
  return result.isOk() ? setResponse(c, { code: ResultCodes.I0000 }, result.value) : setResponse(c, result.error)
})

// --- 作成 POST /books ---
const createBookRoute = createRoute({
  path: '/',
  method: 'post',
  description: '蔵書作成',
  tags: ['蔵書'],
  request: {
    body: { required: true, content: { 'application/json': { schema: unValidatedCreateBookSchema } } },
  },
  responses: {
    ...genericResponse,
    [httpStatusCodes.OK]: { content: { 'application/json': { schema: statusResultSchema, example: resultExamples.status } }, description: '蔵書作成成功' },
  },
})
bookRoute.openapi(createBookRoute, async (c) => {
  const validatedRequest = validateCreateBook(c.req.valid('json'))
  const result = await bookCreateUsecase(bookRepository, textLogger, validatedRequest)
  return result.isOk() ? setResponse(c, { code: ResultCodes.I0000 }) : setResponse(c, result.error)
})

// --- 更新 PUT /books/{id} ---
const updateBookRoute = createRoute({
  path: '/{id}',
  method: 'put',
  description: '蔵書更新',
  tags: ['蔵書'],
  request: {
    params: idRequestParams,
    body: { required: true, content: { 'application/json': { schema: unValidatedUpdateBookSchema } } },
  },
  responses: {
    ...genericResponse,
    [httpStatusCodes.OK]: { content: { 'application/json': { schema: statusResultSchema, example: resultExamples.status } }, description: '蔵書更新成功' },
  },
})
bookRoute.openapi(updateBookRoute, async (c) => {
  const validatedRequest = validateUpdateBook(c.req.valid('json'))
  const result = await bookUpdateUsecase(bookRepository, textLogger, c.req.valid('param').id, validatedRequest)
  return result.isOk() ? setResponse(c, { code: ResultCodes.I0000 }) : setResponse(c, result.error)
})

// --- 無効化（論理削除）DELETE /books/{id} ---
const inactivateBookRoute = createRoute({
  path: '/{id}',
  method: 'delete',
  description: '蔵書削除',
  tags: ['蔵書'],
  request: { params: idRequestParams },
  responses: {
    ...genericResponse,
    [httpStatusCodes.OK]: { content: { 'application/json': { schema: statusResultSchema, example: resultExamples.status } }, description: '蔵書削除成功' },
  },
})
bookRoute.openapi(inactivateBookRoute, async (c) => {
  const result = await bookInactivateUsecase(bookRepository, textLogger, c.req.valid('param').id)
  return result.isOk() ? setResponse(c, { code: ResultCodes.I0000 }) : setResponse(c, result.error)
})

// --- 復元 PUT /books/activate/{id} ---
const activateBookRoute = createRoute({
  path: '/activate/{id}',
  method: 'put',
  description: '蔵書復元',
  tags: ['蔵書'],
  request: { params: idRequestParams },
  responses: {
    ...genericResponse,
    [httpStatusCodes.OK]: { content: { 'application/json': { schema: statusResultSchema, example: resultExamples.status } }, description: '蔵書復元成功' },
  },
})
bookRoute.openapi(activateBookRoute, async (c) => {
  const result = await bookActivateUsecase(bookRepository, textLogger, c.req.valid('param').id)
  return result.isOk() ? setResponse(c, { code: ResultCodes.I0000 }) : setResponse(c, result.error)
})
```

**ハンドラの定型**（これさえ掴めば全 CRUD 同じ）:

```
1. c.req.valid('query'|'param'|'json') で検証済み入力を取り出す
2. interface の validate...() で domain の型へ変換（必要な操作のみ）
3. usecase(repository, logger, ...) を呼ぶ
4. result.isOk() で分岐し setResponse(c, {code:I0000}, データ) / setResponse(c, result.error)
```

---

## 8. ルート集約 `interface/routerIndex.ts`

各機能ルーターをパスにマウントします。

```ts
// src/api/interface/routerIndex.ts
import { createOpenApiHono } from '@infrastructure/middleware/honoOpenApiFactory'
import { bookRoute } from '@interface/router/bookRouter'

export const apiRouter = createOpenApiHono()
apiRouter.route('/books', bookRoute)
```

## 9. エントリポイント差し替え `serverIndex.ts`

01章で作った最小版を、本実装に差し替えます。

```ts
// src/api/serverIndex.ts
import { swaggerUI } from '@hono/swagger-ui'
import { OpenAPIHono } from '@hono/zod-openapi'
import { loadEnv } from '@infrastructure/config/env'
import { getDbInstance } from '@infrastructure/database/dbAccess'
import { textLogger } from '@infrastructure/logger/logger'
import { globalErrorHandler } from '@infrastructure/middleware/errorHandler'
import { apiRouter } from '@interface/routerIndex'
import { serve } from 'bun'

const appConfig = loadEnv()
getDbInstance() // 起動時に接続を初期化

const app = new OpenAPIHono()

app.route('/', apiRouter)

app.doc('/json', {
  openapi: '3.1.0',
  info: { version: '1.0.0', title: '図書館システム学習API' },
})
app.get('/api-docs', swaggerUI({ url: '/json' }))

app.onError(globalErrorHandler) // 例外を統一形式へ

const server = serve({ fetch: app.fetch, port: appConfig.system.port })
textLogger.info(`PORT ${server.port} で起動しました`)
```

---

## この章のまとめ

- `createRoute`（仕様宣言）+ `app.openapi(route, handler)`（実装）が zod-openapi の基本形
- リクエストは宣言スキーマで自動検証され、OpenAPI ドキュメントも自動生成される
- `unValidated*`(生) → `validate*()` → `domain.parse()` の **2段階バリデーション**
- レスポンスは `setResponse` で `{ apiStatus, data }` に統一。コードは `APIResultValue` で日本語＋HTTPステータスに対応付け
- 検証失敗は `defaultHook`(1段目) と `globalErrorHandler`(2段目) が拾う

これで book の CRUD が HTTP から叩ける状態になりました。次章で実際に動かして確認します。
