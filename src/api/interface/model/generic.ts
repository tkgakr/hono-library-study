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
  z.object({
    apiStatus: apiStatusSchema,
    data: z.object({ value: z.array(dataSchema), total: z.int().openapi({ example: 0 }) }),
  })

// --- URL クエリのページング ---
export const unValidatedSearchConditionPagingUrlQuerySchema = z.object({
  page: z.string().optional().openapi({ example: '1' }),
  'items-per-page': z.string().optional().openapi({ example: '10' }),
})
type UnValidatedPagingQuery = z.infer<typeof unValidatedSearchConditionPagingUrlQuerySchema>

export type UnValidatedUrlQueryParameter = Record<string, unknown>
export const convertSearchConditionPagingUrlQueryToParameters = (
  query: UnValidatedPagingQuery,
): UnValidatedUrlQueryParameter => {
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
