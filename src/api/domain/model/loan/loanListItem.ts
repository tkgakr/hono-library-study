import { z } from 'zod'
import { loanStatuses } from '@domain/model/loan/loan'

// 一覧の1行 (join 済みの集約ビュー)
export const loanListItemSchema = z
  .object({
    id: z.uuid(),
    bookTitle: z.string(),
    memberName: z.string(),
    loanedOn: z.date(),
    dueOn: z.date(),
    returnedOn: z.date().nullable(),
    status: z.enum([loanStatuses.ON_LOAN, loanStatuses.OVERDUE, loanStatuses.RETURNED]),
  })
  .brand<'LoanListItem'>()
export type LoanListItem = z.infer<typeof loanListItemSchema>
