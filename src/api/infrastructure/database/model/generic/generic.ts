import type { PgColumnBuilderBase } from 'drizzle-orm/pg-core'

// 「テーブル名 + カラム名」をまとめて受け渡すための型
export interface DatabaseTableConfig {
  name: string
  columns: Record<string, PgColumnBuilderBase>
}
