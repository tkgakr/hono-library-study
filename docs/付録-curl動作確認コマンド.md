# 付録: curl 動作確認コマンド集（book / member）

[08-動作確認-縦1本を通す.md](08-動作確認-縦1本を通す.md) の内容を、**そのまま CLI にコピペして実行できる形**にまとめたものです。
`jq` が必要です（未インストールなら `brew install jq`）。

## 0. 準備

```sh
docker compose up --build -d
docker compose exec api bun run db:migrate
```

以降のコマンドで使う共通変数（同じシェルセッション内で1回だけ実行）:

```sh
export BASE=http://localhost:3000
```

Swagger UI: `http://localhost:3000/api-docs`

---

## 1. book（蔵書）

| メソッド | パス | 操作 |
| --- | --- | --- |
| GET | `/books` | 一覧取得 |
| POST | `/books` | 作成 |
| GET | `/books/{id}` | 詳細取得 |
| PUT | `/books/{id}` | 更新 |
| DELETE | `/books/{id}` | 無効化（論理削除） |
| PUT | `/books/activate/{id}` | 復元 |

### 1-1. 作成 → id の取得

作成レスポンスは `apiStatus` のみ（id は返らない）ので、一覧の完全一致検索で id を取り出します。

```sh
# 作成
curl -s -X POST "$BASE/books" \
  -H 'Content-Type: application/json' \
  -d '{"title":"吾輩は猫である","author":"夏目漱石"}' | jq

# id を控える（title 完全一致で検索）
export BOOK_ID=$(curl -s -G "$BASE/books" \
  --data-urlencode 'title=吾輩は猫である' | jq -r '.data.value[0].id')
echo "BOOK_ID=$BOOK_ID"
```

### 1-2. 一覧取得（検索・ページング・ソート）

```sh
# 全件
curl -s "$BASE/books" | jq

# 簡易検索（title / author を部分一致 ilike）
curl -s -G "$BASE/books" --data-urlencode 'search-filter=猫' | jq

# 有効フラグで絞る
curl -s "$BASE/books?is-active=true" | jq

# ページング（1ページ10件の1ページ目）
curl -s "$BASE/books?page=1&items-per-page=10" | jq

# ソート（title 昇順）
curl -s "$BASE/books?attr=title&sort=asc" | jq
```

### 1-3. 詳細 / 更新 / 無効化 / 復元

```sh
# 詳細
curl -s "$BASE/books/$BOOK_ID" | jq

# 更新（author だけ変更）
curl -s -X PUT "$BASE/books/$BOOK_ID" \
  -H 'Content-Type: application/json' \
  -d '{"author":"夏目 漱石"}' | jq

# 無効化（論理削除：isActive=false）
curl -s -X DELETE "$BASE/books/$BOOK_ID" | jq

# 無効化されたことを確認
curl -s "$BASE/books/$BOOK_ID" | jq '.data.value.isActive'

# 復元
curl -s -X PUT "$BASE/books/activate/$BOOK_ID" | jq
```

### 1-4. エラー系

```sh
# ① route スキーマ違反（title 欠落）→ 400 / W9901（defaultHook）
curl -s -X POST "$BASE/books" \
  -H 'Content-Type: application/json' -d '{"author":"夏目漱石"}' | jq

# ② domain ルール違反（title も author も無い）→ 400 / W9901（globalErrorHandler）
curl -s -X PUT "$BASE/books/$BOOK_ID" \
  -H 'Content-Type: application/json' -d '{}' | jq

# ③ 存在しない id → 404 / W0101
curl -s "$BASE/books/00000000-0000-0000-0000-000000000000" | jq

# ④ タイトル重複 → 2回目は 400 / W0103
curl -s -X POST "$BASE/books" -H 'Content-Type: application/json' \
  -d '{"title":"重複本","author":"著者"}' >/dev/null
curl -s -X POST "$BASE/books" -H 'Content-Type: application/json' \
  -d '{"title":"重複本","author":"著者"}' | jq

# ⑤ 有効な蔵書をさらに復元 → 404 / W0102（状態不正）
curl -s -X PUT "$BASE/books/activate/$BOOK_ID" | jq
```

---

## 2. member（利用者）

| メソッド | パス | 操作 |
| --- | --- | --- |
| GET | `/members` | 一覧取得 |
| POST | `/members` | 作成 |
| GET | `/members/{id}` | 詳細取得 |
| PUT | `/members/{id}` | 更新 |
| DELETE | `/members/{id}` | 無効化（論理削除） |
| PUT | `/members/activate/{id}` | 復元 |

### 2-1. 作成 → id の取得

```sh
# 作成
curl -s -X POST "$BASE/members" \
  -H 'Content-Type: application/json' \
  -d '{"name":"山田太郎","email":"yamada@example.com"}' | jq

# id を控える（email 完全一致で検索）
export MEMBER_ID=$(curl -s -G "$BASE/members" \
  --data-urlencode 'email=yamada@example.com' | jq -r '.data.value[0].id')
echo "MEMBER_ID=$MEMBER_ID"
```

### 2-2. 一覧取得（検索・ページング・ソート）

```sh
# 全件
curl -s "$BASE/members" | jq

# 簡易検索（name / email を部分一致 ilike）
curl -s -G "$BASE/members" --data-urlencode 'search-filter=山田' | jq

# 有効フラグで絞る
curl -s "$BASE/members?is-active=true" | jq

# ページング
curl -s "$BASE/members?page=1&items-per-page=10" | jq

# ソート（name 昇順 / email 降順が指定可能）
curl -s "$BASE/members?attr=name&sort=asc" | jq
curl -s "$BASE/members?attr=email&sort=desc" | jq
```

### 2-3. 詳細 / 更新 / 無効化 / 復元

```sh
# 詳細
curl -s "$BASE/members/$MEMBER_ID" | jq

# 更新（name だけ変更）
curl -s -X PUT "$BASE/members/$MEMBER_ID" \
  -H 'Content-Type: application/json' \
  -d '{"name":"山田 太郎"}' | jq

# 更新（email だけ変更）
curl -s -X PUT "$BASE/members/$MEMBER_ID" \
  -H 'Content-Type: application/json' \
  -d '{"email":"yamada.taro@example.com"}' | jq

# 無効化（論理削除：isActive=false）
curl -s -X DELETE "$BASE/members/$MEMBER_ID" | jq

# 無効化されたことを確認
curl -s "$BASE/members/$MEMBER_ID" | jq '.data.value.isActive'

# 復元
curl -s -X PUT "$BASE/members/activate/$MEMBER_ID" | jq
```

### 2-4. エラー系

```sh
# ① route スキーマ違反（email 欠落）→ 400 / W9901（defaultHook）
curl -s -X POST "$BASE/members" \
  -H 'Content-Type: application/json' -d '{"name":"山田太郎"}' | jq

# ② domain ルール違反（email 形式不正：interface は min(1) しか見ない）→ 400 / W9901
curl -s -X POST "$BASE/members" \
  -H 'Content-Type: application/json' -d '{"name":"山田太郎","email":"not-an-email"}' | jq

# ③ domain ルール違反（name も email も無い）→ 400 / W9901
curl -s -X PUT "$BASE/members/$MEMBER_ID" \
  -H 'Content-Type: application/json' -d '{}' | jq

# ④ 存在しない id → 404 / W0201
curl -s "$BASE/members/00000000-0000-0000-0000-000000000000" | jq

# ⑤ email 重複 → 2回目は 400 / W0203
curl -s -X POST "$BASE/members" -H 'Content-Type: application/json' \
  -d '{"name":"重複ユーザー","email":"dup@example.com"}' >/dev/null
curl -s -X POST "$BASE/members" -H 'Content-Type: application/json' \
  -d '{"name":"別ユーザー","email":"dup@example.com"}' | jq

# ⑥ 有効な利用者をさらに復元 → 404 / W0202（状態不正）
curl -s -X PUT "$BASE/members/activate/$MEMBER_ID" | jq

# ⑦ 無効化済みの利用者を更新 → 404 / W0202
curl -s -X DELETE "$BASE/members/$MEMBER_ID" >/dev/null
curl -s -X PUT "$BASE/members/$MEMBER_ID" \
  -H 'Content-Type: application/json' -d '{"name":"更新できない"}' | jq
curl -s -X PUT "$BASE/members/activate/$MEMBER_ID" >/dev/null  # 後片付け（復元）
```

---

## 3. まとめて一気に流す（スモークテスト）

book / member の CRUD を上から下まで通すワンショット。HTTP ステータスとレスポンスコードだけを表示します。

```sh
export BASE=http://localhost:3000

smoke() {  # smoke <method> <path> [json]
  local method=$1 path=$2 body=${3:-}
  local out
  if [ -n "$body" ]; then
    out=$(curl -s -w '\n%{http_code}' -X "$method" "$BASE$path" \
      -H 'Content-Type: application/json' -d "$body")
  else
    out=$(curl -s -w '\n%{http_code}' -X "$method" "$BASE$path")
  fi
  local status=$(printf '%s' "$out" | tail -n1)
  local json=$(printf '%s' "$out" | sed '$d')
  printf '%-6s %-34s %s %s\n' "$method" "$path" "$status" \
    "$(printf '%s' "$json" | jq -rc '.apiStatus // empty')"
}

# --- book ---
smoke POST   /books '{"title":"スモーク本","author":"著者A"}'
BOOK_ID=$(curl -s -G "$BASE/books" --data-urlencode 'title=スモーク本' | jq -r '.data.value[0].id')
smoke GET    /books
smoke GET    "/books/$BOOK_ID"
smoke PUT    "/books/$BOOK_ID" '{"author":"著者B"}'
smoke DELETE "/books/$BOOK_ID"
smoke PUT    "/books/activate/$BOOK_ID"
smoke POST   /books '{"author":"著者だけ"}'                  # W9901 期待
smoke GET    /books/00000000-0000-0000-0000-000000000000    # W0101 期待

# --- member ---
smoke POST   /members '{"name":"スモーク太郎","email":"smoke@example.com"}'
MEMBER_ID=$(curl -s -G "$BASE/members" --data-urlencode 'email=smoke@example.com' | jq -r '.data.value[0].id')
smoke GET    /members
smoke GET    "/members/$MEMBER_ID"
smoke PUT    "/members/$MEMBER_ID" '{"name":"スモーク次郎"}'
smoke DELETE "/members/$MEMBER_ID"
smoke PUT    "/members/activate/$MEMBER_ID"
smoke POST   /members '{"name":"名前だけ"}'                     # W9901 期待
smoke GET    /members/00000000-0000-0000-0000-000000000000    # W0201 期待
```

## 4. レスポンスコード早見表

| コード | HTTP | 意味 | 発生箇所 |
| --- | --- | --- | --- |
| `I0000` | 200 | 正常 | `setResponse` |
| `W9900` | 400 | リクエストフォーマットエラー | infrastructure |
| `W9901` | 400 | バリデーションエラー | `defaultHook` / `globalErrorHandler` |
| `W0101` | 404 | 蔵書が存在しない | `bookGet*/Update/Inactivate` usecase |
| `W0102` | 404 | 蔵書が操作可能な状態でない | `bookActivateUsecase` など |
| `W0103` | 400 | 同名の蔵書が既に存在する | `checkBookTitleExists` |
| `W0201` | 404 | 利用者が存在しない | `memberGet*/Update/Inactivate` usecase |
| `W0202` | 404 | 利用者が操作可能な状態でない | `memberUpdate/ActivateUsecase` |
| `W0203` | 400 | 同じ email の利用者が既に存在する | `checkMemberEmailExists` |
| `E01xx` / `E02xx` | 500 | book / member のシステムエラー | repository 例外 |
| `E9999` | 500 | 内部エラー | `globalErrorHandler` |
