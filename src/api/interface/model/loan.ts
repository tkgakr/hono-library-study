import type { ValidatedCreateLoan } from '@domain/model/loan/loan'
import { validatedCreateLoanSchema } from '@domain/model/loan/loan'
import type { LoanListItem } from '@domain/model/loan/loanListItem'
import type { ValidatedGetListLoanSearchConditions } from '@domain/model/loan/loanSearchConditions'
import { validatedGetListLoanSearchConditionsSchema } from '@domain/model/loan/loanSearchConditions'
import { z } from '@hono/zod-openapi'
import type { DefaultSortItem, SortableColumnMap } from '@interface/model/generic'
import {
  convertSearchConditionPagingUrlQueryToParameters,
  convertSearchConditionSortUrlQueryToParameters,
  unValidatedSearchConditionPagingUrlQuerySchema,
  unValidatedSearchConditionSortUrlQuerySchema,
} from '@interface/model/generic'

// --- 一覧取得の URL クエリ ---
export const unValidatedGetListLoanUrlQuerySchema = z
  .object({
    'book-id': z.uuid().optional().openapi({ description: '蔵書ID' }),
    'member-id': z.uuid().optional().openapi({ description: '利用者ID' }),
  })
  .extend(unValidatedSearchConditionPagingUrlQuerySchema.shape)
  .extend(unValidatedSearchConditionSortUrlQuerySchema.shape)
  .brand<'UnValidatedGetListLoanUrlQuery'>()
export type UnValidatedGetListLoanUrlQuery = z.infer<typeof unValidatedGetListLoanUrlQuerySchema>

const sortableColumnMap: SortableColumnMap = {
  loaned_on: 'loaned_on',
  due_on: 'due_on',
  returned_on: 'returned_on',
}
const defaultSort: DefaultSortItem[] = [{ column: 'created_at', order: 'asc' }]

export const validateGetListLoanUrlQuery = (
  query: UnValidatedGetListLoanUrlQuery,
): ValidatedGetListLoanSearchConditions =>
  validatedGetListLoanSearchConditionsSchema.parse({
    parameters: { bookId: query['book-id'], memberId: query['member-id'] },
    paging: convertSearchConditionPagingUrlQueryToParameters(query),
    sort: convertSearchConditionSortUrlQueryToParameters(query, sortableColumnMap, defaultSort),
  })

// --- 作成 ---
// 生の HTTP：日付は ISO 文字列で受ける
export const unValidatedCreateLoanSchema = z
  .object({
    bookId: z.uuid().openapi({ description: '蔵書ID', example: '550e8400-e29b-41d4-a716-446655440000' }),
    memberId: z.uuid().openapi({ description: '利用者ID', example: '550e8400-e29b-41d4-a716-446655440001' }),
    loanedOn: z.iso.date().openapi({ description: '貸出日(YYYY-MM-DD)', example: '2026-06-22' }),
    dueOn: z.iso.date().openapi({ description: '返却期限(YYYY-MM-DD)', example: '2026-07-06' }),
  })
  .brand<'UnValidatedCreateLoan'>()
export type UnValidatedCreateLoan = z.infer<typeof unValidatedCreateLoanSchema>

// 継ぎ目：文字列 → Date に変換してから domain の parse へ
export const validateCreateLoan = (request: UnValidatedCreateLoan): ValidatedCreateLoan =>
  validatedCreateLoanSchema.parse({
    bookId: request.bookId,
    memberId: request.memberId,
    loanedOn: new Date(request.loanedOn),
    dueOn: new Date(request.dueOn),
  })

// 例：レスポンス整形（Date → ISO 文字列、status はそのまま）
export const formatLoanListItem = (item: LoanListItem) => ({
  ...item,
  loanedOn: item.loanedOn.toISOString().slice(0, 10),
  dueOn: item.dueOn.toISOString().slice(0, 10),
  returnedOn: item.returnedOn ? item.returnedOn.toISOString().slice(0, 10) : null,
})
