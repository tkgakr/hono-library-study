import { boolean, timestamp, uuid } from 'drizzle-orm/pg-core'

// 共通項目に ID を入れるのは、SQLアンチパターンの「ID リクワイアド」を踏んでるが、規約を優先する
export const primaryId = uuid().primaryKey()
const isActive = boolean().notNull().default(true)
export const createdAt = timestamp({ withTimezone: true }).notNull().defaultNow()
// PostgreSQL には MySQL の ON UPDATE CURRENT_TIMESTAMP がなく、DEFAULT は INSERT 時しか効かない。
// $onUpdate は drizzle が UPDATE 文に自動でこの列を足してくれる仕組み（DDL は変わらない）。
// set() に含めなくても更新されるため、各リポジトリで書き忘れる余地がない。
// デフォルト値を持たない列は INSERT 時にも適用されるため、この列は作成時点から値が入る。
// 「NULL = 未更新」ではなく「常に最終更新時刻（作成直後は createdAt と同値）」として扱う。
export const updatedAt = timestamp({ withTimezone: true }).$onUpdate(() => new Date())

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
