# 05. Infrastructure層 — book テーブルとリポジトリ実装

前章で作った契約 `IBookRepository` を、Drizzle で**実装**します。infrastructure 層の役割は「DB の物理構造」と「DB I/O 時の型変換」だけ。ビジネスロジックは持ちません。

作るファイル:

```
src/api/infrastructure/database/
├─ model/book/book.ts                 … Drizzle テーブル定義 + drizzle-zod parse
├─ repository/
│  ├─ genericRepository.ts            … 共通の query 補助・トランザクション
│  └─ bookRepository.ts               … IBookRepository の実装
```

---

## 1. Drizzle テーブル定義と parse `model/book/book.ts`

このファイルは3つの仕事をします。

1. **テーブル定義**（共通カラム + book 固有カラム）
2. **DTO**（select で取得するカラムの明示）と検索・ソート可能カラムの**ホワイトリスト**
3. **drizzle-zod で insert/update のペイロードを parse する関数**（操作ごと）

```ts
// src/api/infrastructure/database/model/book/book.ts
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
```

### 勘所

- カラムは共通部品 `defaultTableColumns`（id / isActive / 日時）を spread し、book 固有の `title`/`author` を足すだけ。
- **DTO**(`bookDTOSchema`)で取得カラムを明示 → 余計なカラムを引かない & 型が締まる。
- **ホワイトリスト**(`searchablePgColumnMap`/`sortablePgColumnMap`)で「外部から指定できるカラム」を限定 → 任意カラム指定によるインジェクションを防ぐ。
- `createInsertSchema`/`createUpdateSchema`（drizzle-zod）で、保存前にもう一度 parse。`updatedAt`/`createdAt`/`id` は `omit` して更新対象から外す。

---

## 2. 共通リポジトリ部品 `repository/genericRepository.ts`

トランザクション実行と、動的クエリへの order by / limit offset 付与をまとめます。

```ts
// src/api/infrastructure/database/repository/genericRepository.ts
import { isEmptyArray } from '@core/core'
import type { ValidatedSearchConditionPaging, ValidatedSearchConditionSort } from '@domain/model/generic/searchCondition'
import { getDbInstance } from '@infrastructure/database/dbAccess'
import { textLogger } from '@infrastructure/logger/logger'
import type { ExtractTablesWithRelations, SQL } from 'drizzle-orm'
import { asc, desc } from 'drizzle-orm'
import type { NodePgQueryResultHKT } from 'drizzle-orm/node-postgres'
import type { PgColumn, PgSelectQueryBuilder, PgTransaction } from 'drizzle-orm/pg-core'

export const executeTransaction = async (
  transactionFn: (
    trx: PgTransaction<NodePgQueryResultHKT, Record<string, never>, ExtractTablesWithRelations<Record<string, unknown>>>,
  ) => Promise<boolean>,
): Promise<boolean> => {
  const db = getDbInstance()
  try {
    return await db.transaction(async (trx) => {
      const result = await transactionFn(trx)
      if (!result) trx.rollback() // falsy なら全体をロールバック
      return result
    })
  } catch (error) {
    textLogger.error(`DBの保存処理に失敗しました。: ${(error as Error).message}`)
    return false
  }
}

export type SortablePgColumnMap = Record<string, PgColumn>

export const buildOrderByConditions = (sort: ValidatedSearchConditionSort | undefined, sortableColumnMap: SortablePgColumnMap): SQL[] => {
  const orderBy = sort?.orderBy
  if (!orderBy) return []
  return orderBy.reduce((acc: SQL[], item) => {
    const column = sortableColumnMap[item.column]
    if (!column) return acc // ホワイトリストにないカラムは無視
    acc.push(item.order === 'asc' ? asc(column) : desc(column))
    return acc
  }, [] as SQL[])
}

export const addOrderBy = <T extends PgSelectQueryBuilder>(query: T, sort: ValidatedSearchConditionSort | undefined, map: SortablePgColumnMap): T => {
  const conditions = buildOrderByConditions(sort, map)
  if (!isEmptyArray(conditions)) query.orderBy(...conditions)
  return query
}

export const addLimitOffset = <T extends PgSelectQueryBuilder>(query: T, paging: ValidatedSearchConditionPaging | undefined): T => {
  if (paging) {
    if (paging.limit != null) query.limit(paging.limit)
    if (paging.offset != null) query.offset(paging.offset)
  }
  return query
}
```

### 勘所

- `executeTransaction` … `db.transaction` を包み、**コールバックが falsy を返したら `trx.rollback()`**、例外は握ってログを出し `false` を返す。複数件・複数テーブルの更新を「途中失敗で全部巻き戻す」ために使う。
- `addOrderBy` / `addLimitOffset` … `.$dynamic()` で作った動的クエリに条件を後付けする汎用ヘルパ。ソートはホワイトリスト経由なので安全。

> マルチテナント構成では、ここにテナントごとのスキーマへ接続する関数（例：`pgSchema('tenant_<id>').table(...)`）を置くことがあります。本教材は単一スキーマなので `pgTable` をそのまま使い、この関数は省略します。

---

## 3. リポジトリ実装 `repository/bookRepository.ts`

いよいよ `IBookRepository` の実装です。プレーンなオブジェクトとして実装し、`default export` します。

```ts
// src/api/infrastructure/database/repository/bookRepository.ts
import type { GetBook, SaveBook } from '@domain/model/book/book'
import { bookSaveOperations, getBookSchema } from '@domain/model/book/book'
import type { ValidatedGetListBookParameters, ValidatedGetListBookSearchConditions } from '@domain/model/book/bookSearchConditions'
import type { EntityData, ListData } from '@domain/model/generic/repositoryData'
import type { IBookRepository } from '@domain/repository/book/bookRepository'
import { getDbInstance } from '@infrastructure/database/dbAccess'
import bookTable, {
  bookDTOSchema,
  createBookParsedSchema,
  searchablePgColumnMap,
  sortablePgColumnMap,
} from '@infrastructure/database/model/book/book'
import { addLimitOffset, addOrderBy, executeTransaction } from '@infrastructure/database/repository/genericRepository'
import type { SQL } from 'drizzle-orm'
import { and, count, eq, ilike, or } from 'drizzle-orm'

const bookRepository: IBookRepository = {
  fetchList: async (searchConditions: ValidatedGetListBookSearchConditions): Promise<ListData<GetBook>> => {
    const db = getDbInstance()
    let baseQuery = db.select(bookDTOSchema).from(bookTable).where(buildGetListWhereConditions(searchConditions.parameters)).$dynamic()
    baseQuery = addOrderBy(baseQuery, searchConditions.sort, sortablePgColumnMap)
    baseQuery = addLimitOffset(baseQuery, searchConditions.paging)
    const bookDto = await baseQuery

    const countDto = await db.select({ count: count(bookDTOSchema.id) }).from(bookTable).where(buildGetListWhereConditions(searchConditions.parameters))
    const total = countDto[0]?.count ?? 0

    // 取得結果は domain スキーマで parse して境界で型を保証する
    return { value: getBookSchema.array().parse(bookDto), total }
  },

  fetchDetail: async (id: string): Promise<EntityData<GetBook>> => {
    const db = getDbInstance()
    const bookDto = await db.select(bookDTOSchema).from(bookTable).where(eq(bookTable.id, id))
    return { value: bookDto[0] ? getBookSchema.parse(bookDto[0]) : null }
  },

  save: async (command: SaveBook): Promise<boolean> => {
    return await executeTransaction(async (trx) => {
      if (command.operation === bookSaveOperations.CREATE) {
        const result = await trx.insert(bookTable).values(createBookParsedSchema.insertSchema(command)).returning()
        return result.length > 0
      }

      // CREATE 以外は update。operation で set 値を切り替える
      let setValues:
        | ReturnType<typeof createBookParsedSchema.updateSchema>
        | ReturnType<typeof createBookParsedSchema.inactivateSchema>
        | ReturnType<typeof createBookParsedSchema.activateSchema>
      switch (command.operation) {
        case bookSaveOperations.UPDATE:
          setValues = createBookParsedSchema.updateSchema(command)
          break
        case bookSaveOperations.INACTIVATE:
          setValues = createBookParsedSchema.inactivateSchema(command)
          break
        case bookSaveOperations.ACTIVATE:
          setValues = createBookParsedSchema.activateSchema(command)
          break
      }

      const result = await trx.update(bookTable).set(setValues).where(eq(bookTable.id, command.id)).returning()
      return result.length > 0
    })
  },

  findByTitle: async (title: string): Promise<ListData<GetBook>> => {
    const db = getDbInstance()
    const bookDto = await db.select(bookDTOSchema).from(bookTable).where(and(eq(bookTable.title, title), eq(bookTable.isActive, true)))
    return { value: bookDto.map((dto) => getBookSchema.parse(dto)), total: bookDto.length }
  },
}

// 一覧の where 句を、指定されたパラメータだけから動的に組み立てる
const buildGetListWhereConditions = (parameters?: ValidatedGetListBookParameters): SQL | undefined => {
  if (!parameters) return undefined
  const filters: SQL[] = []
  if (parameters.title) filters.push(eq(bookTable.title, parameters.title))
  if (parameters.searchFilter) {
    const simpleSearch = or(...searchablePgColumnMap.map((column) => ilike(column, `%${parameters.searchFilter}%`)))
    if (simpleSearch) filters.push(simpleSearch)
  }
  if (parameters.isActive != null) filters.push(eq(bookTable.isActive, parameters.isActive))
  return filters.length > 0 ? and(...filters) : undefined
}

export default bookRepository
```

### 勘所

- **境界で必ず parse**：取得した DTO を `getBookSchema.parse()`（一覧は `.array().parse()`）に通してから返す。DB の値が想定どおりかを境界で検証し、型安全をドメイン側へ持ち込む。
- **`save` は `operation` で分岐**：domain の `SaveBook`（直和型）を受け取り、create は insert、それ以外は update。set 値は drizzle-zod で parse 済みのものだけを渡す（生データを直接渡さない）。
- **一覧は count を別クエリで取得**：ページング用の総件数。
- **where は条件を配列に push して `and(...)`**：指定された絞り込みだけを動的に組む。簡易検索は `ilike` を `or` で束ねる。

---

## 4. マイグレーションを生成・適用する

テーブル定義ができたので、マイグレーションファイルを生成して DB に流します。コンテナ内で実行します。

```sh
docker compose exec api bash

# book テーブルのマイグレーションを生成
bun run db:generate --name create_book
# 生成された SQL を DB に適用
bun run db:migrate
```

`src/api/infrastructure/database/migrations/` に SQL が出力され、`book` テーブルが作られます。psql で確認するなら:

```sh
docker compose exec pgdb psql -U postgres -d library -c '\d book'
```

---

## この章のまとめ

- `model/book/book.ts` … Drizzle テーブル + DTO + ホワイトリスト + drizzle-zod parse（操作別）
- `genericRepository.ts` … `executeTransaction` と動的クエリ補助
- `bookRepository.ts` … `IBookRepository` の実装。境界で `getBookSchema.parse()`、`save` は `operation` 分岐、where は動的組み立て
- マイグレーションを生成・適用して `book` テーブルを作成

これで「DB に蔵書を保存・取得する実体」ができました。ただしまだ誰も呼んでいません。次章の **application 層**が、この実装（の契約）を使って処理を段取りします。
