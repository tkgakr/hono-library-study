import { isEmptyArray } from '@core/core'
import type {
  ValidatedSearchConditionPaging,
  ValidatedSearchConditionSort,
} from '@domain/model/generic/searchCondition'
import { getDbInstance } from '@infrastructure/database/dbAccess'
import { textLogger } from '@infrastructure/logger/logger'
import type { ExtractTablesWithRelations, SQL } from 'drizzle-orm'
import { asc, desc } from 'drizzle-orm'
import type { NodePgQueryResultHKT } from 'drizzle-orm/node-postgres'
import type { PgColumn, PgSelectQueryBuilder, PgTransaction } from 'drizzle-orm/pg-core'

export const executeTransaction = async (
  transactionFn: (
    trx: PgTransaction<
      NodePgQueryResultHKT,
      Record<string, never>,
      ExtractTablesWithRelations<Record<string, unknown>>
    >,
  ) => Promise<boolean>,
): Promise<boolean> => {
  const db = getDbInstance()
  try {
    return await db.transaction(async (trx) => {
      const result = await transactionFn(trx)
      if (!result) trx.rollback() // falsy なら全体をロールバック
      return result
    })
  } catch (error) {
    textLogger.error(`DBの保存処理に失敗しました。: ${(error as Error).message}`)
    return false
  }
}

export type SortablePgColumnMap = Record<string, PgColumn>

export const buildOrderByConditions = (
  sort: ValidatedSearchConditionSort | undefined,
  sortableColumnMap: SortablePgColumnMap,
): SQL[] => {
  const orderBy = sort?.orderBy
  if (!orderBy) return []
  return orderBy.reduce((acc: SQL[], item) => {
    const column = sortableColumnMap[item.column]
    if (!column) return acc // ホワイトリストにないカラムは無視
    acc.push(item.order === 'asc' ? asc(column) : desc(column))
    return acc
  }, [] as SQL[])
}

export const addOrderBy = <T extends PgSelectQueryBuilder>(
  query: T,
  sort: ValidatedSearchConditionSort | undefined,
  map: SortablePgColumnMap,
): T => {
  const conditions = buildOrderByConditions(sort, map)
  if (!isEmptyArray(conditions)) query.orderBy(...conditions)
  return query
}

export const addLimitOffset = <T extends PgSelectQueryBuilder>(
  query: T,
  paging: ValidatedSearchConditionPaging | undefined,
): T => {
  if (paging) {
    if (paging.limit != null) query.limit(paging.limit)
    if (paging.offset != null) query.offset(paging.offset)
  }
  return query
}
