import type { GetBook, SaveBook } from '@domain/model/book/book'
import { bookSaveOperations, getBookSchema } from '@domain/model/book/book'
import type {
  ValidatedGetListBookParameters,
  ValidatedGetListBookSearchConditions,
} from '@domain/model/book/bookSearchConditions'
import type { EntityData, ListData } from '@domain/model/generic/repositoryData'
import type { IBookRepository } from '@domain/repository/book/bookRepository'
import { getDbInstance } from '@infrastructure/database/dbAccess'
import bookTable, {
  bookDTOSchema,
  createBookParsedSchema,
  searchablePgColumnMap,
  sortablePgColumnMap,
} from '@infrastructure/database/model/book/book'
import { addLimitOffset, addOrderBy, executeTransaction } from '@infrastructure/database/repository/genericRepository'
import type { SQL } from 'drizzle-orm'
import { and, count, eq, ilike, or } from 'drizzle-orm'

const bookRepository: IBookRepository = {
  fetchList: async (searchConditions: ValidatedGetListBookSearchConditions): Promise<ListData<GetBook>> => {
    const db = getDbInstance()
    let baseQuery = db
      .select(bookDTOSchema)
      .from(bookTable)
      .where(buildGetListWhereConditions(searchConditions.parameters))
      .$dynamic()
    baseQuery = addOrderBy(baseQuery, searchConditions.sort, sortablePgColumnMap)
    baseQuery = addLimitOffset(baseQuery, searchConditions.paging)
    const bookDto = await baseQuery

    const countDto = await db
      .select({ count: count(bookDTOSchema.id) })
      .from(bookTable)
      .where(buildGetListWhereConditions(searchConditions.parameters))
    const total = countDto[0]?.count ?? 0

    // 取得結果は domain スキーマで parse して境界で型を保証する
    return { value: getBookSchema.array().parse(bookDto), total }
  },

  fetchDetail: async (id: string): Promise<EntityData<GetBook>> => {
    const db = getDbInstance()
    const bookDto = await db.select(bookDTOSchema).from(bookTable).where(eq(bookTable.id, id))
    return { value: bookDto[0] ? getBookSchema.parse(bookDto[0]) : null }
  },

  save: async (command: SaveBook): Promise<boolean> => {
    return await executeTransaction(async (trx) => {
      if (command.operation === bookSaveOperations.CREATE) {
        const result = await trx.insert(bookTable).values(createBookParsedSchema.insertSchema(command)).returning()
        return result.length > 0
      }

      // CREATE 以外は update。operation で set 値を切り替える
      let setValues:
        | ReturnType<typeof createBookParsedSchema.updateSchema>
        | ReturnType<typeof createBookParsedSchema.inactivateSchema>
        | ReturnType<typeof createBookParsedSchema.activateSchema>
      switch (command.operation) {
        case bookSaveOperations.UPDATE:
          setValues = createBookParsedSchema.updateSchema(command)
          break
        case bookSaveOperations.INACTIVATE:
          setValues = createBookParsedSchema.inactivateSchema(command)
          break
        case bookSaveOperations.ACTIVATE:
          setValues = createBookParsedSchema.activateSchema(command)
          break
      }

      const result = await trx.update(bookTable).set(setValues).where(eq(bookTable.id, command.id)).returning()
      return result.length > 0
    })
  },

  findByTitle: async (title: string): Promise<ListData<GetBook>> => {
    const db = getDbInstance()
    const bookDto = await db
      .select(bookDTOSchema)
      .from(bookTable)
      .where(and(eq(bookTable.title, title), eq(bookTable.isActive, true)))
    return { value: bookDto.map((dto) => getBookSchema.parse(dto)), total: bookDto.length }
  },
}

// 一覧の where 句を、指定されたパラメータだけから動的に組み立てる
const buildGetListWhereConditions = (parameters?: ValidatedGetListBookParameters): SQL | undefined => {
  if (!parameters) return undefined
  const filters: SQL[] = []
  if (parameters.title) filters.push(eq(bookTable.title, parameters.title))
  if (parameters.searchFilter) {
    const simpleSearch = or(...searchablePgColumnMap.map((column) => ilike(column, `%${parameters.searchFilter}%`)))
    if (simpleSearch) filters.push(simpleSearch)
  }
  if (parameters.isActive != null) filters.push(eq(bookTable.isActive, parameters.isActive))
  return filters.length > 0 ? and(...filters) : undefined
}

export default bookRepository
