# 01. Docker Compose 開発環境の構築

`@hono/zod-openapi` を学ぶための図書館システム（library API）の開発環境を、Docker Compose で立ち上げる手順です。
実務で広く使われる構成（Bun ランタイム / Drizzle / PostgreSQL / パスエイリアス）に揃えてあります。

## このテキストのゴール

- `docker compose up` で **Hono(OpenAPIHono) サーバ + PostgreSQL** が起動する
- `http://localhost:3000/health` が `200` を返す
- `http://localhost:3000/api-docs` で Swagger UI（OpenAPI ドキュメント）が開ける
- `bun run db:migrate` 相当でマイグレーションが流せる状態になる

> ドメイン（books / members / loans）の実装は次のテキスト以降で行います。本章は「空のサーバが DB につながって動く」ところまでです。

## 前提

- Docker / Docker Compose が入っていること（`docker compose version` が通る）
- エディタ。Bun や Node はホストに無くても OK（すべてコンテナ内で動かす）

---

## 1. プロジェクトの雛形を作る

作業ディレクトリは本番リポジトリの外、`~/github/tkgakr/hono-library-study/` を想定します。

```sh
cd ~/github/tkgakr/hono-library-study
mkdir -p src/api
git init        # 任意
```

最終的に本章で作るファイルはこれだけです。

```
hono-library-study/
├─ docker-compose.yml
├─ Dockerfile.local
├─ .env
├─ .gitignore
├─ package.json
├─ tsconfig.json
├─ bunfig.toml
├─ biome.json
└─ src/
   └─ api/
      ├─ serverIndex.ts
      └─ infrastructure/
         └─ database/
            └─ drizzle.config.ts
```

---

## 2. package.json

実務でよくある scripts と依存構成です（学習に不要なログ基盤 / 認証系は省略）。

```json
{
  "name": "library",
  "type": "module",
  "scripts": {
    "dev": "bun run --hot src/api/serverIndex.ts",
    "build": "bun build src/api/serverIndex.ts --outdir dist/api --target bun",
    "start": "bun dist/api/serverIndex.js",
    "test": "bun test",
    "biome:check": "biome check .",
    "biome:fix": "biome check --write .",
    "db:generate": "bunx drizzle-kit generate --config src/api/infrastructure/database/drizzle.config.ts",
    "db:migrate": "bunx drizzle-kit migrate --config src/api/infrastructure/database/drizzle.config.ts"
  },
  "dependencies": {
    "@formkit/tempo": "^1.0.0",
    "@hono/swagger-ui": "^0.5.3",
    "@hono/zod-openapi": "^1.3.0",
    "drizzle-kit": "^0.31.10",
    "drizzle-orm": "^0.45.2",
    "drizzle-zod": "^0.8.3",
    "hono": "^4.12.14",
    "neverthrow": "^8.2.0",
    "pg": "^8.20.0",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@biomejs/biome": "^2.4.12",
    "@tsconfig/bun": "^1.0.10",
    "@tsconfig/strictest": "^2.0.8",
    "@types/bun": "latest",
    "@types/pg": "^8.20.0"
  }
}
```

> マイグレーションは drizzle-kit 標準の `migrate` を使います。

---

## 3. tsconfig.json / bunfig.toml（パスエイリアス）

`@domain` `@application` `@interface` `@infrastructure` エイリアスを使えるようにします。
TypeScript 用（型解決）と Bun 用（実行・ビルド時解決）の **両方** に書くのがポイントです。

### tsconfig.json

```json
{
  "extends": "@tsconfig/bun/tsconfig.json",
  "compilerOptions": {
    "strict": true,
    "baseUrl": "./",
    "paths": {
      "@application/*": ["src/api/application/*"],
      "@core/*": ["src/api/core/*"],
      "@domain/*": ["src/api/domain/*"],
      "@infrastructure/*": ["src/api/infrastructure/*"],
      "@interface/*": ["src/api/interface/*"],
      "@test/*": ["src/test/*"]
    }
  },
  "include": ["src"]
}
```

### bunfig.toml

```toml
[build]
[build.alias]
"@application" = "./src/api/application"
"@core" = "./src/api/core"
"@domain" = "./src/api/domain"
"@infrastructure" = "./src/api/infrastructure"
"@interface" = "./src/api/interface"
"@test" = "./src/test"
```

---

## 4. biome.json（Lint / Format）

学習用に最小化した設定です。

```json
{
  "$schema": "https://biomejs.dev/schemas/2.4.12/schema.json",
  "files": { "includes": ["src/**/*.ts"] },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 150
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "correctness": {
        "noUnusedImports": "error",
        "noUnusedVariables": "error"
      },
      "style": {
        "useImportType": "error"
      }
    }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "semicolons": "asNeeded",
      "trailingCommas": "all"
    }
  }
}
```

---

## 5. .env と .gitignore

`DATABASE_URL` のホスト名は compose のサービス名 `pgdb` を指します。

### .env

```sh
DATABASE_URL=postgres://postgres:postgres@pgdb:5432/library
DEBUG=true
PORT=3000
TZ=Asia/Tokyo
```

### .gitignore

```
node_modules
dist
.env
```

> 学習用なので `.env` をそのまま置いていますが、実務では `.env.template` を別に用意し、`.env` は git 管理外にするのが定石です。

---

## 6. Dockerfile.local

Bun 公式イメージを使って動かす構成です。
`curl | bash` で実行時にインストーラを取得する形や、追加の `apt-get install` は避けます。
イメージはバージョンと digest を固定し、ビルドの再現性を上げつつ、意図しないタグ更新の影響を抑えます。
依存パッケージは `bun.lock` を使って固定し、Docker build では `--frozen-lockfile` で lockfile からずれたインストールを失敗させます。
コードは compose の volume でマウントするため、`COPY` ＆ `bun install` は初回の依存解決用です。

```dockerfile
# Bun 公式イメージを digest 固定して実行
FROM oven/bun:1.3.12-slim@sha256:d3c7094c144dd3975d183a4dbc4ec0a764223995bff73290d983edb47043a75f

WORKDIR /app
RUN chown bun:bun /app
USER bun

COPY --chown=bun:bun package.json bun.lock ./
RUN bun install --frozen-lockfile

CMD ["bun", "run", "dev"]
```

> digest 固定はサプライチェーンリスクを下げる一方で、セキュリティ修正版への自動追従もしません。
> Bun やベースイメージを更新する場合は、公式タグの digest を確認して Dockerfile とこの手順書を一緒に更新します。

---

## 7. docker-compose.yml

PostgreSQL サービス（`postgres:16.8` / `timezone=Asia/Tokyo`）と API の 2 サービス構成にします。

```yaml
services:
  api:
    container_name: library_api
    build:
      context: .
      dockerfile: Dockerfile.local
    ports:
      - "3000:3000"
    volumes:
      - .:/app
      # ホストの node_modules でコンテナ内を上書きしないための除外マウント
      - /app/node_modules
    env_file:
      - .env
    depends_on:
      pgdb:
        condition: service_healthy

  pgdb:
    container_name: library_pgdb
    image: postgres:16.8
    ports:
      - "5432:5432"
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: library
    command: ["postgres", "-c", "timezone=Asia/Tokyo"]
    volumes:
      - pgdb_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d library"]
      interval: 3s
      timeout: 3s
      retries: 10

volumes:
  pgdb_data:
    driver: local
```

ポイント:
- `POSTGRES_DB: library` で初回起動時に DB を自動作成（`.env` の接続先と一致）
- `healthcheck` + `depends_on: condition: service_healthy` で「DB が受付可能になってから API 起動」を保証
- `- /app/node_modules` の匿名ボリュームで、コンテナ内 install 済みの依存をホスト側マウントで潰さないようにする

---

## 8. drizzle.config.ts

`schema` のグロブをプロジェクトの配置に合わせます。

```ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  out: './src/api/infrastructure/database/migrations',
  schema: './src/api/infrastructure/database/model/**/*.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL as string,
  },
  casing: 'snake_case',
})
```

> 本章ではまだ `model/` 配下にテーブル定義が無いので、`db:generate` は「変更なし」となります。次章で最初のテーブルを足します。

---

## 9. serverIndex.ts（最小の OpenAPIHono サーバ）

エントリポイントの最小形です。`OpenAPIHono` を立て、`createRoute` でヘルスチェックを 1 本定義し、Swagger UI を出します。
**`@hono/zod-openapi` の最小形がこの 1 ファイルに詰まっています。**

```ts
import { swaggerUI } from '@hono/swagger-ui'
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { serve } from 'bun'

const app = new OpenAPIHono()

// --- ヘルスチェック: createRoute で OpenAPI 定義を作り、app.openapi で実装を結びつける ---
const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  responses: {
    200: {
      description: 'OK',
      content: {
        'application/json': {
          schema: z.object({ status: z.literal('ok') }),
        },
      },
    },
  },
})

app.openapi(healthRoute, (c) => c.json({ status: 'ok' as const }))

// --- OpenAPI ドキュメント (/json) と Swagger UI (/api-docs) ---
app.doc('/json', {
  openapi: '3.1.0',
  info: { version: '1.0.0', title: '図書館システム学習API' },
})
app.get('/api-docs', swaggerUI({ url: '/json' }))

const server = serve({
  fetch: app.fetch,
  port: Number(process.env.PORT ?? 3000),
})

console.log(`PORT ${server.port} で起動しました`)
```

---

## 10. 起動と動作確認

### 起動

```sh
docker compose up --build
```

初回は Bun インストール込みでビルドされます。`PORT 3000 で起動しました` が出れば成功です。

### 確認

別ターミナルから:

```sh
# ヘルスチェック → {"status":"ok"}
curl http://localhost:3000/health

# OpenAPI JSON が返る
curl http://localhost:3000/json
```

ブラウザで Swagger UI を開く:

```
http://localhost:3000/api-docs
```

`/health` エンドポイントが 1 本表示され、`Try it out` で叩けたら完成です。

### よく使うコマンド

コンテナの中に入って Bun コマンドを実行します。

```sh
# コンテナ内シェル
docker compose exec api bash

# 以降はコンテナ内で
bun run biome:fix      # Lint / Format
bun run db:generate    # スキーマ → マイグレーション生成（次章以降で使用）
bun run db:migrate     # マイグレーション適用
bun run test           # テスト
```

### 停止 / リセット

```sh
docker compose down            # 停止
docker compose down -v         # DB データごと破棄（pgdb_data ボリュームを削除）
```

---

## トラブルシューティング

| 症状 | 原因と対処 |
| --- | --- |
| `bun: command not found` (compose exec 時) | コンテナを再ビルド: `docker compose build --no-cache api` |
| API が `ECONNREFUSED ... pgdb:5432` | DB 起動前に API が動いた。`depends_on.condition: service_healthy` が効いているか確認。`docker compose up` し直す |
| `.env` を変えても反映されない | `env_file` はコンテナ起動時に読まれる。`docker compose up` で再起動する |
| `node_modules` 関連の不整合 | ホスト側に `node_modules` を作ってしまった場合は削除。依存はコンテナ内で完結させる |

---

## 次の章でやること

- `src/api/infrastructure/database/dbAccess.ts`（pg プール + drizzle インスタンス）
- 最初のドメイン `book` を 4 層（domain → infrastructure → application → interface）で縦に 1 本通す
- `createRoute` でのリクエスト（path / query / body）バリデーションと、`c.req.valid(...)` の受け取り
