import { boolean, timestamp, uuid } from 'drizzle-orm/pg-core'

// 共通項目に ID を入れるのは、SQLアンチパターンの「ID リクワイアド」を踏んでるが、規約を優先する
export const primaryId = uuid().primaryKey()
const isActive = boolean().notNull().default(true)
export const createdAt = timestamp({ withTimezone: true }).notNull().defaultNow()
export const updatedAt = timestamp({ withTimezone: true })

export const defaultTimestamps = {
  createdAt,
  updatedAt,
}

// id / isActive / 作成・更新日時 をまとめた標準カラム群
// 「isActive:有効フラグ」とはしているが、「とりあえず削除フラグ」アンチパターンを踏んでいる
export const defaultTableColumns = {
  ...defaultTimestamps,
  id: primaryId,
  isActive,
}
