import type { ValidatedCreateMember, ValidatedUpdateMember } from '@domain/model/member/member'
import { validatedCreateMemberSchema, validatedUpdateMemberSchema } from '@domain/model/member/member'
import type { ValidatedGetListMemberSearchConditions } from '@domain/model/member/memberSearchConditions'
import { validatedGetListMemberSearchConditionsSchema } from '@domain/model/member/memberSearchConditions'
import { z } from '@hono/zod-openapi'
import type { DefaultSortItem, SortableColumnMap } from '@interface/model/generic'
import {
  convertSearchConditionPagingUrlQueryToParameters,
  convertSearchConditionSortUrlQueryToParameters,
  unValidatedSearchConditionPagingUrlQuerySchema,
  unValidatedSearchConditionSortUrlQuerySchema,
} from '@interface/model/generic'
import { UnValidatedGetListBookUrlQuery } from './book'

// --- 一覧取得の URL クエリ ---
export const unValidatedGetListMemberUrlQuerySchema = z
  .object({
    email: z.string().optional().openapi({ description: 'メールアドレス', example: 'hoge@example.com' }),
    'search-filter': z.string().optional().openapi({ description: '簡易検索（name/email 対象）', example: '山田' }),
    'is-active': z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => (v == null ? undefined : v === 'true'))
      .openapi({ description: '有効フラグ', example: 'true' }),
  })
  .extend(unValidatedSearchConditionPagingUrlQuerySchema.shape)
  .extend(unValidatedSearchConditionSortUrlQuerySchema.shape)
  .brand<'UnvalidatedGetListMemberUrlQuery'>()
export type UnValidatedGetListMemberUrlQuery = z.infer<typeof unValidatedGetListMemberUrlQuerySchema>

const sortableClumnMap: SortableColumnMap = { name: 'name', email: 'email' }
const defaultSort: DefaultSortItem[] = [{ column: 'created_at', order: 'asc' }]
