import { toCalendarDate } from '@core/core'
import type { EntityData, ListData } from '@domain/model/generic/repositoryData'
import type { GetLoan, SaveLoan } from '@domain/model/loan/loan'
import { getLoanSchema, loanSaveOperations, resolveLoanStatus } from '@domain/model/loan/loan'
import type { LoanListItem } from '@domain/model/loan/loanListItem'
import { loanListItemSchema } from '@domain/model/loan/loanListItem'
import type { ILoanRepository } from '@domain/repository/loan/loanRepository'
import { getDbInstance } from '@infrastructure/database/dbAccess'
import bookTable from '@infrastructure/database/model/book/book'
import loanTable, { createLoanParsedSchema, loanDTOSchema } from '@infrastructure/database/model/loan/loan'
import memberTable from '@infrastructure/database/model/member/member'
import { executeTransaction } from '@infrastructure/database/repository/genericRepository'
import { and, eq, isNull } from 'drizzle-orm'

const loanRepository: ILoanRepository = {
  fetchListWithRelations: async (): Promise<ListData<LoanListItem>> => {
    const db = getDbInstance()
    // join して必要なカラムだけ取得（DTO 投影）
    const rows = await db
      .select({
        id: loanTable.id,
        bookId: loanTable.bookId,
        memberId: loanTable.memberId,
        bookTitle: bookTable.title,
        memberName: memberTable.name,
        loanedOn: loanTable.loanedOn,
        dueOn: loanTable.dueOn,
        returnedOn: loanTable.returnedOn,
      })
      .from(loanTable)
      .innerJoin(bookTable, eq(loanTable.bookId, bookTable.id))
      .innerJoin(memberTable, eq(loanTable.memberId, memberTable.id))

    // 現在時刻は暦日に正規化して渡す（期限当日を延滞と誤判定しないため）
    const today = toCalendarDate(new Date())
    // 取得した行を集約レスポンス型に組み立てる（ステータスはドメイン関数で算出）
    const value = rows.map((row) => {
      const loan = getLoanSchema.parse({
        id: row.id,
        bookId: row.bookId,
        memberId: row.memberId,
        loanedOn: row.loanedOn,
        dueOn: row.dueOn,
        returnedOn: row.returnedOn,
      })
      return loanListItemSchema.parse({
        id: row.id,
        bookTitle: row.bookTitle,
        memberName: row.memberName,
        loanedOn: row.loanedOn,
        dueOn: row.dueOn,
        returnedOn: row.returnedOn,
        status: resolveLoanStatus(loan, today),
      })
    })
    return { value, total: value.length }
  },

  fetchDetail: async (id: string): Promise<EntityData<GetLoan>> => {
    const db = getDbInstance()
    const loanDto = await db.select(loanDTOSchema).from(loanTable).where(eq(loanTable.id, id))
    return { value: loanDto[0] ? getLoanSchema.parse(loanDto[0]) : null }
  },

  save: async (command: SaveLoan): Promise<boolean> => {
    return await executeTransaction(async (trx) => {
      if (command.operation === loanSaveOperations.CREATE) {
        const result = await trx.insert(loanTable).values(createLoanParsedSchema.insertSchema(command)).returning()
        return result.length > 0
      }

      // 返却は未返却の行だけを対象にする（二重返却を DB 側で弾き、更新0件 = false になる）
      const result = await trx
        .update(loanTable)
        .set(createLoanParsedSchema.returnSchema(command))
        .where(and(eq(loanTable.id, command.id), isNull(loanTable.returnedOn)))
        .returning()
      return result.length > 0
    })
  },
}

export default loanRepository
