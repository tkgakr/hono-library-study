export const isEmptyArray = <T>(value: T[]): boolean => value.length === 0

export const isEmptyOrWhitespaceString = (value: string): boolean => value.trim().length === 0

// switch の網羅漏れをコンパイル時に検出するための番人。
// 全ケースを処理していれば引数は never に絞られ、union にケースが増えた瞬間に型エラーになる。
// 到達するのは型を迂回した場合だけなので、実行時は例外にする。
export const assertNever = (value: never): never => {
  throw new Error(`未対応の値です: ${JSON.stringify(value)}`)
}

// 「時刻を持たない暦日」を表す型。実体は Date だが、toCalendarDate() でしか作れない。
// 日付比較の引数をこの型で受けておけば、時刻付きの `new Date()` の混入を型で防げる。
declare const calendarDateBrand: unique symbol
export type CalendarDate = Date & { readonly [calendarDateBrand]: true }

// 時刻を持つ「瞬間」を、その暦日の 0 時（UTC）だけを持つ Date に正規化する。
// PostgreSQL の date 型カラムは drizzle が `new Date('2026-07-06')` = UTC 0 時として返すため、
// 日付同士を比較するときは現在時刻もこの表現に揃える必要がある。
// 暦日の判定はローカルタイムゾーン（本アプリは TZ=Asia/Tokyo）で行う。
export const toCalendarDate = (instant: Date): CalendarDate =>
  new Date(Date.UTC(instant.getFullYear(), instant.getMonth(), instant.getDate())) as CalendarDate
