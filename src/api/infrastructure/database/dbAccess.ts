import { loadEnv } from '@infrastructure/config/env'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

let dbInstance: NodePgDatabase | undefined

// シングルトン
export const getDbInstance = (): NodePgDatabase => {
  if (!dbInstance) dbInstance = createDbConnection()
  return dbInstance
}

// テスト等で新規接続したいときはこっちを直接コール
export const createDbConnection = (): NodePgDatabase => {
  const appConfig = loadEnv()
  return drizzle({
    client: new Pool({
      connectionString: appConfig.database.url,
      min: appConfig.database.poolMin,
      max: appConfig.database.poolMax,
    }),
    // Drizzle が camelCase のプロパティ名を snake_case のカラム名へ自動変換する
    // https://orm.drizzle.team/docs/sql-schema-declaration#camel-and-snake-casing
    casing: 'snake_case',
    // true の時、実行SQL をログに出力
    logger: appConfig.system.debug,
  })
}
