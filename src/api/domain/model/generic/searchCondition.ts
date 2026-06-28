import z from 'zod'

// .brand<'...'>() とは？
// zod の ブランド型です。中身が同じ { limit, offset } でも、ブランドが違えば TypeScript 上は別の型として扱われます。
// これにより「検証前の生データ」と「検証済みのドメイン値」を取り違えるミスをコンパイル時に防げます。

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
