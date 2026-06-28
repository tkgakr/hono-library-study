// コード体系は {ステータス I/W/E}{機能2桁}{連番2桁} とする。
// 図書館では book = 01、member = 02、loan = 03 を割り当て。
export const ResultCodes = {
  // 正常
  I0000: 'I0000', // 成功

  // 警告（業務的な失敗：見つからない・状態不正・重複など）
  W9900: 'W9900', // リクエストフォーマットエラー
  W9901: 'W9901', // バリデーションエラー
  // book
  W0101: 'W0101', // 指定の蔵書が存在しない
  W0102: 'W0102', // 操作可能な状態でない
  W0103: 'W0103', // 同名の蔵書が既に存在する

  // エラー（システム的な失敗：DB 例外など）
  // book
  E0101: 'E0101', // 一覧取得失敗
  E0102: 'E0102', // 取得失敗
  E0103: 'E0103', // 保存失敗
  E0104: 'E0104', // 重複チェック失敗
  // generic
  E9999: 'E9999', // 内部エラー
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
