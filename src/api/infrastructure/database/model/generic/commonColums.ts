import { boolean, timestamp, uuid } from 'drizzle-orm/pg-core'

export const primaryId = uuid().primaryKey()
const isActive = boolean().notNull().default(true)
export const createdAt = timestamp({ withTimezone: true }).notNull().defaultNow()
export const updatedAt = timestamp({ withTimezone: true })

export const defaultTimestamps = {
  createdAt,
  updatedAt,
}

// id / isActive / 作成・更新日時 をまとめた標準カラム群
export const defaultTableColumns = {
  ...defaultTimestamps,
  id: primaryId,
  isActive,
}
