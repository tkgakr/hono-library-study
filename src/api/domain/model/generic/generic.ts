// コード体系は {ステータス I/W/E}{機能2桁}{連番2桁} とする。
// 図書館では book = 01、member = 02、loan = 03 を割り当て。
// 99 は機能横断の汎用コードに予約する。
// キーは `{機能}_{内容}` の SCREAMING_SNAKE_CASE、値はコード文字列。
// 各ブロック内は機能番号の昇順（generic=99 は末尾）で並べる。
export const ResultCodes = {
  // 正常
  SUCCESS: 'I0000', // 成功

  // 警告（業務的な失敗：見つからない・状態不正・重複など）
  // book
  BOOK_NOT_FOUND: 'W0101', // 指定の蔵書が存在しない
  BOOK_INVALID_STATE: 'W0102', // 操作可能な状態でない
  BOOK_ALREADY_EXISTS: 'W0103', // 同名の蔵書が既に存在する
  // member
  MEMBER_NOT_FOUND: 'W0201', // 指定の利用者が存在しない
  MEMBER_INVALID_STATE: 'W0202', // 操作可能な状態でない
  MEMBER_ALREADY_EXISTS: 'W0203', // 同じメールアドレスの利用者が既に存在する
  // generic
  INVALID_REQUEST_FORMAT: 'W9900', // リクエストフォーマットエラー
  VALIDATION_FAILED: 'W9901', // バリデーションエラー

  // エラー（システム的な失敗：DB 例外など）
  // book
  BOOK_LIST_FAILED: 'E0101', // 一覧取得失敗
  BOOK_FETCH_FAILED: 'E0102', // 取得失敗
  BOOK_SAVE_FAILED: 'E0103', // 保存失敗
  BOOK_DUPLICATE_CHECK_FAILED: 'E0104', // 重複チェック失敗
  // member
  MEMBER_LIST_FAILED: 'E0201', // 一覧取得失敗
  MEMBER_FETCH_FAILED: 'E0202', // 取得失敗
  MEMBER_SAVE_FAILED: 'E0203', // 保存失敗
  MEMBER_DUPLICATE_CHECK_FAILED: 'E0204', // 重複チェック失敗
  // generic
  INTERNAL_ERROR: 'E9999', // 内部エラー
} as const
export type ResultCode = (typeof ResultCodes)[keyof typeof ResultCodes]

// メッセージに埋め込む引数のキー（例: 「{operation}できません」）
export const ResultMessageArgKeys = {
  OPERATION: 'operation',
  INVALID_PARAMETERS: 'invalidParameters',
} as const
export type ResultMessageArgKey = (typeof ResultMessageArgKeys)[keyof typeof ResultMessageArgKeys]
export type ResultMessageArgs = Partial<Record<ResultMessageArgKey, string>>

// application 層が返す「エラーの中身」
export interface OperationResult {
  code: ResultCode
  args?: ResultMessageArgs
}
