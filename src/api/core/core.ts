export const isEmptyArray = <T>(value: T[]): boolean => value.length === 0

export const isEmptyOrWhitespaceString = (value: string): boolean => value.trim().length === 0

// switch の網羅漏れをコンパイル時に検出するための番人。
// 全ケースを処理していれば引数は never に絞られ、union にケースが増えた瞬間に型エラーになる。
// 到達するのは型を迂回した場合だけなので、実行時は例外にする。
export const assertNever = (value: never): never => {
  throw new Error(`未対応の値です: ${JSON.stringify(value)}`)
}

// 時刻を持つ「瞬間」を、その暦日の 0 時（UTC）だけを持つ Date に正規化する。
// PostgreSQL の date 型カラムは drizzle が `new Date('2026-07-06')` = UTC 0 時として返すため、
// 日付同士を比較するときは現在時刻もこの表現に揃える必要がある。
// 暦日の判定はローカルタイムゾーン（本アプリは TZ=Asia/Tokyo）で行う。
export const toCalendarDate = (instant: Date): Date =>
  new Date(Date.UTC(instant.getFullYear(), instant.getMonth(), instant.getDate()))
