# hono-library-study

`@hono/zod-openapi` を中心に、**図書館システム（library API）**を題材にバックエンドの 4層アーキテクチャを学ぶ教材プロジェクトです。
実務で広く使われる構成（クリーンアーキテクチャ風の 4層 + zod-openapi + Drizzle + neverthrow）を、最小構成で写し取って学べるように作っています。

## 学習スタック

- ランタイム: **Bun**（Bun 公式 Docker イメージ）
- Web: **Hono** / **@hono/zod-openapi**（OpenAPI 自動生成 + リクエスト検証）
- DB: **PostgreSQL** + **Drizzle ORM** / drizzle-zod
- エラー制御: **neverthrow**（Result 型）
- バリデーション: **zod**（branded types）
- テスト: **bun:test**

## 進め方

`docs/` のチャプターを番号順に読み進めます。01〜08 で蔵書(book)の縦1本を作りきり、09 で関連(利用者・貸出)、10 でテスト、11 でまとめと発展トピックを扱います。

## ホスト側で編集する場合

Docker Compose はコンテナ内の `/app/node_modules` に依存をインストールしますが、ホスト側のエディタや `bun run ...` はホスト側の `node_modules` を参照します。
VS Code などで `Cannot find module 'drizzle-kit'` のような解決エラーを出さないため、初回はホスト側でも依存を入れてください。

```sh
bun install --frozen-lockfile
```

`node_modules` は `.gitignore` 対象なので、リポジトリには含めません。

| # | チャプター | 内容 |
| --- | --- | --- |
| 01 | [Docker 環境構築](docs/01-docker環境構築.md) | compose で Bun + PostgreSQL を起動 |
| 02 | [4層アーキテクチャ概観](docs/02-4層アーキテクチャ概観.md) | 依存の向きとリクエストの流れ |
| 03 | [DB接続と Drizzle 基盤](docs/03-DB接続とDrizzle基盤.md) | 接続・共通カラム・設定 |
| 04 | [Domain層 — book モデル](docs/04-Domain層-bookモデル.md) | branded zod・Save 直和型・refine |
| 05 | [Infrastructure層 — book リポジトリ](docs/05-Infrastructure層-bookリポジトリ.md) | Drizzle テーブル・drizzle-zod・実装 |
| 06 | [Application層 — book ユースケース](docs/06-Application層-bookユースケース.md) | neverthrow パイプライン |
| 07 | [Interface層 — zod-openapi ルーター](docs/07-Interface層-zod-openapiルーター.md) | createRoute・2段バリデーション・setResponse |
| 08 | [動作確認 — 縦1本を通す](docs/08-動作確認-縦1本を通す.md) | curl / Swagger で CRUD を一周 |
| 09 | [関連エンティティ — 貸出と返却](docs/09-関連エンティティ-貸出と返却.md) | 日付変換・ステータス算出・join 集約 |
| 10 | [テスト — レイヤー別](docs/10-テスト-レイヤー別.md) | bun:test のテーブル駆動 |
| 11 | [まとめと発展](docs/11-まとめと発展.md) | 発展トピック（マルチテナント/JWT/複合コード） |

## ゴール

- `@hono/zod-openapi` で API を宣言的に定義し、OpenAPI ドキュメントを自動生成できる
- domain / application / infrastructure / interface の 4層を依存の向きを守って実装できる
- neverthrow と Drizzle、bun:test を実務的な流儀で扱える
- 実務の 4層バックエンドを読み解き、同じ設計で機能追加できる

## ディレクトリ構成（完成形）

```
src/api/
├─ core/            … 汎用ヘルパ
├─ domain/          … model / repository(interface) / service(interface)
├─ application/     … usecase / service
├─ infrastructure/  … database(model/repository) / middleware / logger / config
├─ interface/       … model / router / routerIndex.ts
└─ serverIndex.ts   … エントリポイント
src/test/           … 本体と同じレイヤー構成のテスト
```
