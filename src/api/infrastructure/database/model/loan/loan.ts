import type { CreatedLoan, ReturnedLoan } from '@domain/model/loan/loan'
import { defaultTimestamps, primaryId } from '@infrastructure/database/model/generic/commonColumns'
import type { DatabaseTableConfig } from '@infrastructure/database/model/generic/generic'
import { date, pgTable, uuid } from 'drizzle-orm/pg-core'
import { createInsertSchema, createUpdateSchema } from 'drizzle-zod'

const columns = {
  ...defaultTimestamps,
  id: primaryId,
  bookId: uuid().notNull(),
  memberId: uuid().notNull(),
  loanedOn: date({ mode: 'date' }).notNull(),
  dueOn: date({ mode: 'date' }).notNull(),
  returnedOn: date({ mode: 'date' }), // nullable
} as const

export const loanTableConfig: DatabaseTableConfig = {
  name: 'loan',
  columns,
}

const loanTable = pgTable(loanTableConfig.name, columns)
export default loanTable

// select で取得するカラムを明示（DTO）
export const loanDTOSchema = {
  id: loanTable.id,
  bookId: loanTable.bookId,
  memberId: loanTable.memberId,
  loanedOn: loanTable.loanedOn,
  dueOn: loanTable.dueOn,
  returnedOn: loanTable.returnedOn,
} as const

// 操作ごとに insert / update のペイロードを drizzle-zod で parse する
export const createLoanParsedSchema = {
  insertSchema: (created: CreatedLoan): typeof loanTable.$inferInsert =>
    createInsertSchema(loanTable).parse({
      id: created.id,
      bookId: created.bookId,
      memberId: created.memberId,
      loanedOn: created.loanedOn,
      dueOn: created.dueOn,
    }),
  returnSchema: (returned: ReturnedLoan): Partial<Pick<typeof loanTable.$inferSelect, 'returnedOn'>> =>
    createUpdateSchema(loanTable)
      .omit({
        id: true,
        bookId: true,
        memberId: true,
        loanedOn: true,
        dueOn: true,
        createdAt: true,
        updatedAt: true,
      })
      .parse({ returnedOn: returned.returnedOn }),
}
