import type { ILogger } from '@domain/service/logger/iLoggerService'

// ログの実装: 学習用なので console で十分。実務ではログ基盤に `winston` 等を使う
export const textLogger: ILogger = {
  debug: (message) => console.debug(JSON.stringify({ level: 'debug', text: message })),
  verbose: (message) => console.log(JSON.stringify({ level: 'verbose', text: message })),
  info: (message) => console.info(JSON.stringify({ level: 'info', text: message })),
  warn: (message) => console.warn(JSON.stringify({ level: 'warn', text: message })),
  error: (message) => console.error(JSON.stringify({ level: 'error', text: message })),
}
