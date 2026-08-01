import z from 'zod'

export const loanSaveOperations = {
  CREATE: 'create',
  RETURN: 'return',
} as const

// ステータスは保存された日付から算出する派生値（DBには持たない）
export const loanStatuses = {
  ON_LOAN: 'onLoan', // 貸出中
  OVERDUE: 'overdue', // 延滞
  RETURNED: 'returned', // 返却済
} as const
export type LoanStatus = (typeof loanStatuses)[keyof typeof loanStatuses]

// DB から取得した1件
export const getLoanSchema = z
  .object({
    id: z.uuid(),
    bookId: z.uuid(),
    memberId: z.uuid(),
    loanedOn: z.date(),
    dueOn: z.date(),
    returnedOn: z.date().nullable(),
  })
  .brand<'GetLoan'>()
export type GetLoan = z.infer<typeof getLoanSchema>

// (1) 貸出：返却期限は貸出日以降でなければならない（日付をまたぐ refine）
export const validatedCreateLoanSchema = z
  .object({
    bookId: z.uuid(),
    memberId: z.uuid(),
    loanedOn: z.date(),
    dueOn: z.date(),
  })
  .refine((data) => data.dueOn.getTime() >= data.loanedOn.getTime(), {
    message: '返却期限は貸出日以降にしてください',
    path: ['dueOn'],
  })
  .brand<'ValidatedCreateLoan'>()
export type ValidatedCreateLoan = z.infer<typeof validatedCreateLoanSchema>

export const createdLoanSchema = z
  .object({
    operation: z.literal(loanSaveOperations.CREATE),
    id: z.uuid(),
    bookId: z.uuid(),
    memberId: z.uuid(),
    loanedOn: z.date(),
    dueOn: z.date(),
  })
  .brand<'CreatedLoan'>()
export type CreatedLoan = z.infer<typeof createdLoanSchema>

export const createLoan = (entity: ValidatedCreateLoan): CreatedLoan =>
  createdLoanSchema.parse({ operation: loanSaveOperations.CREATE, id: crypto.randomUUID(), ...entity })

// (2) 返却：返却日を記録する
export const returnedLoanSchema = z
  .object({
    operation: z.literal(loanSaveOperations.RETURN),
    id: z.uuid(),
    returnedOn: z.date(),
  })
  .brand<'ReturnedLoan'>()
export type ReturnedLoan = z.infer<typeof returnedLoanSchema>

export const returnLoan = (id: string, returnedOn: Date): ReturnedLoan =>
  returnedLoanSchema.parse({ operation: loanSaveOperations.RETURN, id, returnedOn })

export type SaveLoan = CreatedLoan | ReturnedLoan

// (3) ステータス算出：保存値（日付）からドメインのルールで導く純粋関数
// ステータス判定に必要なのは2つの日付だけ。GetLoan 全体を要求すると、
// 一覧の join 行のように id/bookId/memberId を持たない呼び出し側が値を捏造することになるため、
// 引数は「必要な入力」だけに絞る。
export type LoanStatusSource = Pick<GetLoan, 'dueOn' | 'returnedOn'>

// 延滞は「返却期限を過ぎている」＝ 期限当日は延滞ではない、という日単位の判定。
// そのため today には時刻を含まない暦日（`toCalendarDate()` で正規化した値）を渡すこと。
// 時刻付きの `new Date()` をそのまま渡すと、期限当日の 0 時を過ぎた時点で延滞と誤判定される。
export const resolveLoanStatus = (loan: LoanStatusSource, today: Date): LoanStatus => {
  if (loan.returnedOn !== null) return loanStatuses.RETURNED
  return loan.dueOn.getTime() < today.getTime() ? loanStatuses.OVERDUE : loanStatuses.ON_LOAN
}
