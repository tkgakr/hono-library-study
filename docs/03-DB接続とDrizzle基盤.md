# 03. DB接続と Drizzle 基盤

この章では、全エンティティで使い回す **DB 接続とテーブルの土台**を作ります。具体的なドメイン（book）はまだ作らず、「どのテーブルでも共通の部品」と「接続の入り口」を用意します。マルチテナント機能を含まない最小構成です。

> 実務ではマルチテナント（テナントごとに DB スキーマを分ける）構成もありますが、本教材は単一スキーマ（public）にします。発展的な構成は最終章で触れます。

作るファイル:

```
src/api/
├─ core/core.ts                                   … 汎用ヘルパ
├─ domain/service/logger/iLoggerService.ts         … ログの抽象
└─ infrastructure/
   ├─ config/env.ts                                … 環境変数の読み込み
   ├─ logger/logger.ts                             … ログの実装
   └─ database/
      ├─ dbAccess.ts                               … 接続（シングルトン）
      ├─ drizzle.config.ts                         … マイグレーション設定（01章で作成済み）
      └─ model/generic/
         ├─ commonColumns.ts                       … 共通カラム部品
         └─ generic.ts                             … テーブル設定の型
```

---

## 1. 汎用ヘルパ `core/core.ts`

application 層のチェックで使う小さなユーティリティです（汎用ヘルパ置き場）。

```ts
// src/api/core/core.ts
export const isEmptyArray = <T>(value: T[]): boolean => value.length === 0

export const isEmptyOrWhitespaceString = (value: string): boolean => value.trim().length === 0
```

---

## 2. ログの抽象と実装

ドメインやユースケースは「ログの具体ライブラリ」を知ってはいけません。まず抽象（インターフェース）を domain 側に置きます。

```ts
// src/api/domain/service/logger/iLoggerService.ts
export interface ILogger {
  debug: (message: string) => void
  verbose: (message: string) => void
  info: (message: string) => void
  warn: (message: string) => void
  error: (message: string) => void
}
```

実装は infrastructure 側。学習用は `console` で十分です（実務ではログ基盤に winston 等を使います）。

```ts
// src/api/infrastructure/logger/logger.ts
import type { ILogger } from '@domain/service/logger/iLoggerService'

export const textLogger: ILogger = {
  debug: (message) => console.debug(JSON.stringify({ level: 'debug', text: message })),
  verbose: (message) => console.log(JSON.stringify({ level: 'verbose', text: message })),
  info: (message) => console.info(JSON.stringify({ level: 'info', text: message })),
  warn: (message) => console.warn(JSON.stringify({ level: 'warn', text: message })),
  error: (message) => console.error(JSON.stringify({ level: 'error', text: message })),
}
```

> ポイント: 「抽象は内側 / 実装は外側」。`ILogger` という契約に対して、`console` 版でも winston 版でも差し替え可能です。

---

## 3. 環境変数 `config/env.ts`

`DATABASE_URL` などを **zod で検証してから**読み込みます。検証済みの設定オブジェクトを一度だけ作ってキャッシュします。

```ts
// src/api/infrastructure/config/env.ts
import { env } from 'bun'
import z from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string(),
  DEBUG: z
    .stringbool({ truthy: ['true', 'True', '1'] })
    .optional()
    .default(false),
  POOL_MIN: z.string().optional().default('1'),
  POOL_MAX: z.string().optional().default('10'),
  PORT: z.string().optional().default('3000'),
})

export interface AppConfig {
  database: { url: string; poolMin: number; poolMax: number }
  system: { debug: boolean; port: number }
}

let appConfigInstance: AppConfig | null = null

export const loadEnv = (): AppConfig => {
  if (appConfigInstance) return appConfigInstance

  const parsed = envSchema.safeParse(env)
  if (!parsed.success) throw new Error(parsed.error.message)

  appConfigInstance = {
    database: {
      url: parsed.data.DATABASE_URL,
      poolMin: parseInt(parsed.data.POOL_MIN, 10),
      poolMax: parseInt(parsed.data.POOL_MAX, 10),
    },
    system: {
      debug: parsed.data.DEBUG,
      port: parseInt(parsed.data.PORT, 10),
    },
  }
  return appConfigInstance
}
```

> `z.stringbool` は zod v4 の機能で、`'true'`/`'1'` のような文字列を boolean に変換します。

---

## 4. DB 接続 `dbAccess.ts`

`pg` のコネクションプールを Drizzle に渡し、**インスタンスを1つだけ**生成して使い回します（シングルトン）。

```ts
// src/api/infrastructure/database/dbAccess.ts
import { loadEnv } from '@infrastructure/config/env'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

let dbInstance: NodePgDatabase | undefined

export const getDbInstance = (): NodePgDatabase => {
  if (!dbInstance) dbInstance = createDbConnection()
  return dbInstance
}

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
```

ポイント:
- `casing: 'snake_case'` … Drizzle が **camelCase のプロパティ名を snake_case のカラム名へ自動変換**します。`displayOrder` ↔ `display_order`。
- `logger: debug` … `DEBUG=true` のとき実行 SQL がログに出ます。
- `getDbInstance()` で取得（キャッシュ済み）、`createDbConnection()` はテスト等で新規接続したいとき用。

---

## 5. 共通カラム部品 `model/generic/commonColumns.ts`

全テーブルで共通する「id・作成日時・更新日時・有効フラグ」を**一度だけ**定義し、各テーブルはこれを spread で合成します。

```ts
// src/api/infrastructure/database/model/generic/commonColumns.ts
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
```

> 共通カラムにするのは「全テーブルで本当に共通する項目」だけにします。book 固有の `title`/`author` は各テーブル側に書きます。

## 6. テーブル設定の型 `model/generic/generic.ts`

「テーブル名 + カラム定義」をまとめて受け渡すための型です。`pgTable` に渡す形を統一でき、将来マルチテナント化（テナントごとのスキーマへ同じカラム定義を渡す）する際の拡張点にもなります。

```ts
// src/api/infrastructure/database/model/generic/generic.ts
import type { PgColumnBuilderBase } from 'drizzle-orm/pg-core'

export interface DatabaseTableConfig {
  name: string
  columns: Record<string, PgColumnBuilderBase>
}
```

---

## この章のまとめ

- `core/core.ts` … 後でチェックに使う小道具
- `ILogger`(抽象) / `textLogger`(実装) … 依存性逆転の最小例
- `env.ts` … 環境変数を zod で検証してキャッシュ
- `dbAccess.ts` … `pg` プール + Drizzle のシングルトン。`casing: 'snake_case'` が肝
- `commonColumns.ts` / `generic.ts` … 全テーブル共通の部品と型

これで「DB につなぐ足場」と「全テーブル共通の部品」が揃いました。次章から `book` を題材に、**一番内側の domain 層**から実装していきます。
