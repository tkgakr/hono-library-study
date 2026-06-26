// bun が提供する環境変数オブジェクト。Node.js の process.env に相当し、
// .env ファイルや OS の環境変数を読み込んだ key-value（値は文字列）を保持する。
// これを下の envSchema で検証してから利用する。
import { env } from 'bun'
import z from 'zod'

// 環境変数のスキーマ定義。環境変数は基本すべて文字列で渡ってくるため、
// それを前提に各項目の型・任意/必須・デフォルト値を宣言する。
const envSchema = z.object({
  // DB接続URL。必須項目（未設定だとパースエラーになる）。
  DATABASE_URL: z.string(),
  // デバッグフラグ。文字列を真偽値に変換する zod の stringbool を使用。
  // truthy に列挙した値（'true' / 'True' / '1'）を true とみなす。
  // .optional() で未設定を許容し、.default(false) で未設定時は false にする。
  DEBUG: z
    .stringbool({ truthy: ['true', 'True', '1'] })
    .optional()
    .default(false),
  // コネクションプールの最小数。未設定時は '1'（文字列のまま保持）。
  POOL_MIN: z.string().optional().default('1'),
  // コネクションプールの最大数。未設定時は '10'。
  POOL_MAX: z.string().optional().default('10'),
  // サーバの待ち受けポート。未設定時は '3000'。
  PORT: z.string().optional().default('3000'),
})

export interface AppConfig {
  database: { url: string; poolMin: number; poolMax: number }
  system: { debug: boolean; port: number }
}

let appConfigInstance: AppConfig | null = null

export const loadEnv = (): AppConfig => {
  if (appConfigInstance) return appConfigInstance

  // bun の env を上で定義したスキーマで検証する。
  // safeParse は例外を投げず { success, data | error } を返すため、
  // 成否を自分でハンドリングできる（parse は失敗時に例外を投げる）。
  const parsed = envSchema.safeParse(env)
  // 検証失敗（必須項目の欠落や型不一致）時は、ここで明示的にエラーを投げて
  // 起動を中断する。parsed.success が true の場合のみ以降で parsed.data を使える。
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
