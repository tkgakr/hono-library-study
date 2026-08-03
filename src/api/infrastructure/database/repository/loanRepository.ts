import type { CalendarDate } from '@core/core'
import { assertNever } from '@core/core'
import type { EntityData, ListData } from '@domain/model/generic/repositoryData'
import type { GetLoan, SaveLoan } from '@domain/model/loan/loan'
import { getLoanSchema, loanSaveOperations, resolveLoanStatus } from '@domain/model/loan/loan'
import type { LoanListItem } from '@domain/model/loan/loanListItem'
import { loanListItemSchema } from '@domain/model/loan/loanListItem'
import type {
  ValidatedGetListLoanParameters,
  ValidatedGetListLoanSearchConditions,
} from '@domain/model/loan/loanSearchConditions'
import type { ILoanRepository } from '@domain/repository/loan/loanRepository'
import { getDbInstance } from '@infrastructure/database/dbAccess'
import bookTable from '@infrastructure/database/model/book/book'
import loanTable, {
  createLoanParsedSchema,
  loanDTOSchema,
  sortablePgColumnMap,
} from '@infrastructure/database/model/loan/loan'
import memberTable from '@infrastructure/database/model/member/member'
import { addLimitOffset, addOrderBy, executeTransaction } from '@infrastructure/database/repository/genericRepository'
import type { SQL } from 'drizzle-orm'
import { and, count, eq, isNull } from 'drizzle-orm'

const loanRepository: ILoanRepository = {
  fetchListWithRelations: async (
    today: CalendarDate,
    searchConditions: ValidatedGetListLoanSearchConditions,
  ): Promise<ListData<LoanListItem>> => {
    const db = getDbInstance()
    // join して必要なカラムだけ取得（DTO 投影）
    let baseQuery = db
      .select({
        id: loanTable.id,
        bookTitle: bookTable.title,
        memberName: memberTable.name,
        loanedOn: loanTable.loanedOn,
        dueOn: loanTable.dueOn,
        returnedOn: loanTable.returnedOn,
      })
      .from(loanTable)
      .innerJoin(bookTable, eq(loanTable.bookId, bookTable.id))
      .innerJoin(memberTable, eq(loanTable.memberId, memberTable.id))
      .where(buildGetListWhereConditions(searchConditions.parameters))
      .$dynamic()
    baseQuery = addOrderBy(baseQuery, searchConditions.sort, sortablePgColumnMap)
    baseQuery = addLimitOffset(baseQuery, searchConditions.paging)
    const rows = await baseQuery

    // total は絞り込み後の全件数。ページングを外した同じ条件で数える（join も同じに揃える）
    const countDto = await db
      .select({ count: count(loanTable.id) })
      .from(loanTable)
      .innerJoin(bookTable, eq(loanTable.bookId, bookTable.id))
      .innerJoin(memberTable, eq(loanTable.memberId, memberTable.id))
      .where(buildGetListWhereConditions(searchConditions.parameters))
    const total = countDto[0]?.count ?? 0

    // 取得した行に、ドメイン関数で算出したステータスを足して集約レスポンス型にする
    const value = rows.map((row) => loanListItemSchema.parse({ ...row, status: resolveLoanStatus(row, today) }))
    return { value, total }
  },

  fetchDetail: async (id: string): Promise<EntityData<GetLoan>> => {
    const db = getDbInstance()
    const loanDto = await db.select(loanDTOSchema).from(loanTable).where(eq(loanTable.id, id))
    return { value: loanDto[0] ? getLoanSchema.parse(loanDto[0]) : null }
  },

  save: async (command: SaveLoan): Promise<boolean> => {
    return await executeTransaction(async (trx) => {
      // 操作ごとに文を切り替える。operation が増えたら default で型エラーになる
      switch (command.operation) {
        case loanSaveOperations.CREATE: {
          const result = await trx.insert(loanTable).values(createLoanParsedSchema.insertSchema(command)).returning()
          return result.length > 0
        }
        case loanSaveOperations.RETURN: {
          // 返却は未返却の行だけを対象にする（二重返却を DB 側で弾き、更新0件 = false になる）
          const result = await trx
            .update(loanTable)
            .set(createLoanParsedSchema.returnSchema(command))
            .where(and(eq(loanTable.id, command.id), isNull(loanTable.returnedOn)))
            .returning()
          return result.length > 0
        }
        default:
          return assertNever(command)
      }
    })
  },
}

// 一覧の where 句を、指定されたパラメータだけから動的に組み立てる
const buildGetListWhereConditions = (parameters?: ValidatedGetListLoanParameters): SQL | undefined => {
  if (!parameters) return undefined
  const filters: SQL[] = []
  if (parameters.bookId) filters.push(eq(loanTable.bookId, parameters.bookId))
  if (parameters.memberId) filters.push(eq(loanTable.memberId, parameters.memberId))
  return filters.length > 0 ? and(...filters) : undefined
}

export default loanRepository
