import { defaultTableColumns } from '@infrastructure/database/model/generic/commonColumns'
import type { DatabaseTableConfig } from '@infrastructure/database/model/generic/generic'
import { pgTable, varchar } from 'drizzle-orm/pg-core'

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
