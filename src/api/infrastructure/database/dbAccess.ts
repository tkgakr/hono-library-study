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

// テスト等で新規接続したいとき用
export const createDbConnection = (): NodePgDatabase => {
  const appConfig = loadEnv()
  return drizzle({
    client: new Pool({
      connectionString: appConfig.database.url,
      min: appConfig.database.poolMin,
      max: appConfig.database.poolMax,
    }),
    casing: 'snake_case',
    logger: appConfig.system.debug,
  })
}
