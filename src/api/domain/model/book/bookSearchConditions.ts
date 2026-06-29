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
