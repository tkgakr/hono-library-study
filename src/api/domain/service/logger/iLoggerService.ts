// ログの抽象: ドメインやユースケースは「ログの具体ライブラリ」を知ってはいけない
export interface ILogger {
  debug: (message: string) => void
  verbose: (message: string) => void
  info: (message: string) => void
  warn: (message: string) => void
  error: (message: string) => void
}
