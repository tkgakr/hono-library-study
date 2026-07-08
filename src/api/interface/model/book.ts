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

export const validateGetListBookUrlQuery = (
  query: UnValidatedGetListBookUrlQuery,
): ValidatedGetListBookSearchConditions =>
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

export const validateCreateBook = (request: UnValidatedCreateBook): ValidatedCreateBook =>
  validatedCreateBookSchema.parse(request)

// --- 更新 ---
export const unValidatedUpdateBookSchema = z
  .object({
    title: z.string().min(1).optional().openapi({ description: 'タイトル', example: '吾輩は猫である' }),
    author: z.string().min(1).optional().openapi({ description: '著者', example: '夏目漱石' }),
  })
  .brand<'UnValidatedUpdateBook'>()
export type UnValidatedUpdateBook = z.infer<typeof unValidatedUpdateBookSchema>

export const validateUpdateBook = (request: UnValidatedUpdateBook): ValidatedUpdateBook =>
  validatedUpdateBookSchema.parse(request)
