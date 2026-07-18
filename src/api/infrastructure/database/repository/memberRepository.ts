import type { EntityData, ListData } from '@domain/model/generic/repositoryData'
import type { GetMember, SaveMember } from '@domain/model/member/member'
import { getMemberSchema, memberSaveOperations } from '@domain/model/member/member'
import type {
  ValidatedGetListMemberParameters,
  ValidatedGetListMemberSearchConditions,
} from '@domain/model/member/memberSearchConditions'
import type { IMemberRepository } from '@domain/repository/member/memberRepository'
import { getDbInstance } from '@infrastructure/database/dbAccess'
import memberTable, {
  createMemberParsedSchema,
  memberDTOSchema,
  searchablePgColumnMap,
  sortablePgColumnMap,
} from '@infrastructure/database/model/member/member'
import { addLimitOffset, addOrderBy, executeTransaction } from '@infrastructure/database/repository/genericRepository'
import type { SQL } from 'drizzle-orm'
import { and, count, eq, ilike, or } from 'drizzle-orm'

const memberRepository: IMemberRepository = {
  fetchList: async (searchConditions: ValidatedGetListMemberSearchConditions): Promise<ListData<GetMember>> => {
    const db = getDbInstance()
    let baseQuery = db
      .select(memberDTOSchema)
      .from(memberTable)
      .where(buildGetListWhereConditions(searchConditions.parameters))
      .$dynamic()
    baseQuery = addOrderBy(baseQuery, searchConditions.sort, sortablePgColumnMap)
    baseQuery = addLimitOffset(baseQuery, searchConditions.paging)
    const memberDto = await baseQuery

    const countDto = await db
      .select({ count: count(memberDTOSchema.id) })
      .from(memberTable)
      .where(buildGetListWhereConditions(searchConditions.parameters))
    const total = countDto[0]?.count ?? 0

    // 取得結果は domain スキーマで parse して境界で型を保証する
    return { value: getMemberSchema.array().parse(memberDto), total }
  },

  fetchDetail: async (id: string): Promise<EntityData<GetMember>> => {
    const db = getDbInstance()
    const memberDto = await db.select(memberDTOSchema).from(memberTable).where(eq(memberTable.id, id))
    return { value: memberDto[0] ? getMemberSchema.parse(memberDto[0]) : null }
  },

  save: async (command: SaveMember): Promise<boolean> => {
    return await executeTransaction(async (trx) => {
      if (command.operation === memberSaveOperations.CREATE) {
        const result = await trx.insert(memberTable).values(createMemberParsedSchema.insertSchema(command)).returning()
        return result.length > 0
      }

      // CREATE 以外は update。 operation で set 値を切り替える
      let setValues:
        | ReturnType<typeof createMemberParsedSchema.updateSchema>
        | ReturnType<typeof createMemberParsedSchema.inactivateSchema>
        | ReturnType<typeof createMemberParsedSchema.activateSchema>
      switch (command.operation) {
        case memberSaveOperations.UPDATE:
          setValues = createMemberParsedSchema.updateSchema(command)
          break
        case memberSaveOperations.INACTIVATE:
          setValues = createMemberParsedSchema.inactivateSchema(command)
          break
        case memberSaveOperations.ACTIVATE:
          setValues = createMemberParsedSchema.activateSchema(command)
          break
      }

      const result = await trx.update(memberTable).set(setValues).where(eq(memberTable.id, command.id)).returning()
      return result.length > 0
    })
  },

  findByEmail: async (email: string): Promise<ListData<GetMember>> => {
    const db = getDbInstance()
    const memberDto = await db
      .select(memberDTOSchema)
      .from(memberTable)
      .where(and(eq(memberTable.email, email), eq(memberTable.isActive, true)))
    return { value: memberDto.map((dto) => getMemberSchema.parse(dto)), total: memberDto.length }
  },
}

// 一覧の where 句を、指定されたパラメータだけから動的に組み立てる
const buildGetListWhereConditions = (parameters?: ValidatedGetListMemberParameters): SQL | undefined => {
  if (!parameters) return undefined
  const filters: SQL[] = []
  if (parameters.email) filters.push(eq(memberTable.email, parameters.email))
  if (parameters.searchFilter) {
    const simpleSearch = or(...searchablePgColumnMap.map((column) => ilike(column, `%${parameters.searchFilter}%`)))
    if (simpleSearch) filters.push(simpleSearch)
  }
  if (parameters.isActive != null) filters.push(eq(memberTable.isActive, parameters.isActive))
  return filters.length > 0 ? and(...filters) : undefined
}

export default memberRepository
