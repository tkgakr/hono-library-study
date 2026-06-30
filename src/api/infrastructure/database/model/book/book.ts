import type { ActivatedBook, CreatedBook, InactivatedBook, UpdatedBook } from '@domain/model/book/book'
import { defaultTableColumns } from '@infrastructure/database/model/generic/commonColumns'
import type { DatabaseTableConfig } from '@infrastructure/database/model/generic/generic'
import type { SortablePgColumnMap } from '@infrastructure/database/repository/genericRepository'
import type { PgColumn } from 'drizzle-orm/pg-core'
import { pgTable, varchar } from 'drizzle-orm/pg-core'
import { createInsertSchema, createUpdateSchema } from 'drizzle-zod'

// 共通カラム + book 固有カラム
const columns = {
  ...defaultTableColumns,
  title: varchar({ length: 255 }).notNull(),
  author: varchar({ length: 255 }).notNull(),
} as const

export const bookTableConfig: DatabaseTableConfig = {
  name: 'book',
  columns,
}

const bookTable = pgTable(bookTableConfig.name, columns)
export default bookTable

// select で取得するカラムを明示（DTO）
export const bookDTOSchema = {
  id: bookTable.id,
  title: bookTable.title,
  author: bookTable.author,
  isActive: bookTable.isActive,
} as const

// 簡易検索の対象カラム（ホワイトリスト）
export const searchablePgColumnMap: PgColumn[] = [bookTable.title, bookTable.author]

// ソート可能カラム（クエリのカラム名 → 実カラム）
export const sortablePgColumnMap: SortablePgColumnMap = {
  title: bookTable.title,
  created_at: bookTable.createdAt,
} as const

// 操作ごとに insert / update のペイロードを drizzle-zod で parse する
export const createBookParsedSchema = {
  insertSchema: (created: CreatedBook): typeof bookTable.$inferInsert =>
    createInsertSchema(bookTable).parse({
      id: created.id,
      title: created.title,
      author: created.author,
      isActive: true,
    }),
  updateSchema: (updated: UpdatedBook): Partial<Pick<typeof bookTable.$inferSelect, 'title' | 'author'>> =>
    createUpdateSchema(bookTable)
      .omit({ id: true, isActive: true, createdAt: true, updatedAt: true })
      .parse({ title: updated.title, author: updated.author }),
  inactivateSchema: (inactivated: InactivatedBook): Partial<Pick<typeof bookTable.$inferSelect, 'isActive'>> =>
    createUpdateSchema(bookTable)
      .omit({ id: true, title: true, author: true, createdAt: true, updatedAt: true })
      .parse({ isActive: inactivated.isActive }),
  activateSchema: (activated: ActivatedBook): Partial<Pick<typeof bookTable.$inferSelect, 'isActive'>> =>
    createUpdateSchema(bookTable)
      .omit({ id: true, title: true, author: true, createdAt: true, updatedAt: true })
      .parse({ isActive: activated.isActive }),
}
