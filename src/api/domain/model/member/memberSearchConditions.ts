import {
  validatedSearchConditionPagingSchema,
  validatedSearchConditionSortSchema,
} from '@domain/model/generic/searchCondition'
import z from 'zod'

const validatedGetListMemberParametersSchema = z.object({
  name: z.string().optional(),
  searchFilter: z.string().optional(),
  isActive: z.boolean().optional(),
})
export type ValidatedGetListMemberParameters = z.infer<typeof validatedGetListMemberParametersSchema>

export const validatedGetListMemberSearchConditionsSchema = z
  .object({
    parameters: validatedGetListMemberParametersSchema.optional(),
    paging: validatedSearchConditionPagingSchema,
    sort: validatedSearchConditionSortSchema,
  })
  .brand<'ValidatedGetListMemberSearchConditions'>()
export type ValidatedGetListMemberSearchConditions = z.infer<typeof validatedGetListMemberSearchConditionsSchema>
