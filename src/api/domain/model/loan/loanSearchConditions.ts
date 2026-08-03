import {
  validatedSearchConditionPagingSchema,
  validatedSearchConditionSortSchema,
} from '@domain/model/generic/searchCondition'
import z from 'zod'

// 貸出一覧の絞り込み条件。どちらも実カラムなので where 句は素直に組める。
// 「延滞のみ」のようなステータスでの絞り込みは、DB に持たない派生値のため
// resolveLoanStatus と同じルールを where 句に再実装することになる。ここでは持たない。
const validatedGetListLoanParametersSchema = z.object({
  bookId: z.uuid().optional(),
  memberId: z.uuid().optional(),
})
export type ValidatedGetListLoanParameters = z.infer<typeof validatedGetListLoanParametersSchema>

export const validatedGetListLoanSearchConditionsSchema = z
  .object({
    parameters: validatedGetListLoanParametersSchema.optional(),
    paging: validatedSearchConditionPagingSchema,
    sort: validatedSearchConditionSortSchema,
  })
  .brand<'ValidatedGetListLoanSearchConditions'>()
export type ValidatedGetListLoanSearchConditions = z.infer<typeof validatedGetListLoanSearchConditionsSchema>
