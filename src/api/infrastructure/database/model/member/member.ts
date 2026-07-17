import type { ActivatedMember, CreatedMember, InactivatedMember, UpdatedMember } from '@domain/model/member/member'
import { defaultTableColumns } from '@infrastructure/database/model/generic/commonColumns'
import type { DatabaseTableConfig } from '@infrastructure/database/model/generic/generic'
import type { SortablePgColumnMap } from '@infrastructure/database/repository/genericRepository'
import type { PgColumn } from 'drizzle-orm/pg-core'
import { pgTable, varchar } from 'drizzle-orm/pg-core'
import { createInsertSchema, createUpdateSchema } from 'drizzle-zod'

// 共通カラム + member 固有カラム
const columns = {
  ...defaultTableColumns,
  name: varchar({ length: 255 }).notNull(),
  email: varchar({ length: 255 }).notNull(),
} as const

export const memberTableConfig: DatabaseTableConfig = {
  name: 'member',
  columns,
}

const memberTable = pgTable(memberTableConfig.name, columns)
export default memberTable

// select で取得するカラムを明示（DTO）
export const memberDTOSchema = {
  id: memberTable.id,
  name: memberTable.name,
  email: memberTable.email,
  isActive: memberTable.isActive,
} as const

// 簡易検索の対象カラム
export const searchablePgColumnMap: PgColumn[] = [memberTable.name, memberTable.email]

// ソート可能カラム
export const sortablePgColumnMap: SortablePgColumnMap = {
  name: memberTable.name,
  email: memberTable.email,
} as const

// 操作ごとに insert / update のペイロードを drizzle-zod で parse する
export const createMemberParsedSchema = {
  insertSchema: (created: CreatedMember): typeof memberTable.$inferInsert =>
    createInsertSchema(memberTable).parse({
      id: created.id,
      name: created.name,
      email: created.email,
      isActive: true,
    }),
  updateSchema: (updated: UpdatedMember): Partial<Pick<typeof memberTable.$inferSelect, 'name' | 'email'>> =>
    createUpdateSchema(memberTable)
      .omit({ id: true, isActive: true, createdAt: true, updatedAt: true })
      .parse({ name: updated.name, email: updated.email }),
  inactivateSchema: (inactivated: InactivatedMember): Partial<Pick<typeof memberTable.$inferSelect, 'isActive'>> =>
    createUpdateSchema(memberTable)
      .omit({ id: true, name: true, email: true, createdAt: true, updatedAt: true })
      .parse({ isActive: inactivated.isActive }),
  activateSchema: (activated: ActivatedMember): Partial<Pick<typeof memberTable.$inferSelect, 'isActive'>> =>
    createUpdateSchema(memberTable)
      .omit({ id: true, name: true, email: true, createdAt: true, updatedAt: true })
      .parse({ isActive: activated.isActive }),
}
