import type { CreatedLoan, ReturnedLoan } from '@domain/model/loan/loan'
import bookTable from '@infrastructure/database/model/book/book'
import { defaultTimestamps, primaryId } from '@infrastructure/database/model/generic/commonColumns'
import type { DatabaseTableConfig } from '@infrastructure/database/model/generic/generic'
import memberTable from '@infrastructure/database/model/member/member'
import type { SortablePgColumnMap } from '@infrastructure/database/repository/genericRepository'
import { date, pgTable, uuid } from 'drizzle-orm/pg-core'
import { createInsertSchema, createUpdateSchema } from 'drizzle-zod'

const columns = {
  ...defaultTimestamps,
  id: primaryId,
  // 外部キー制約を付けて、参照先の無い貸出（孤立行）が生まれないことを DB に保証させる。
  // これがないと、蔵書や利用者を物理削除したときに innerJoin で貸出行そのものが一覧から消える。
  bookId: uuid()
    .notNull()
    .references(() => bookTable.id),
  memberId: uuid()
    .notNull()
    .references(() => memberTable.id),
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

// ソート可能カラム（クエリのカラム名 → 実カラム）
export const sortablePgColumnMap: SortablePgColumnMap = {
  loaned_on: loanTable.loanedOn,
  due_on: loanTable.dueOn,
  returned_on: loanTable.returnedOn,
  created_at: loanTable.createdAt,
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
