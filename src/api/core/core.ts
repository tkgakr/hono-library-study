export const isEmptyArray = <T>(value: T[]): boolean => value.length === 0

export const isEmptyOrWhitespaceString = (value: string): boolean => value.trim().length === 0

// 時刻を持つ「瞬間」を、その暦日の 0 時（UTC）だけを持つ Date に正規化する。
// PostgreSQL の date 型カラムは drizzle が `new Date('2026-07-06')` = UTC 0 時として返すため、
// 日付同士を比較するときは現在時刻もこの表現に揃える必要がある。
// 暦日の判定はローカルタイムゾーン（本アプリは TZ=Asia/Tokyo）で行う。
export const toCalendarDate = (instant: Date): Date =>
  new Date(Date.UTC(instant.getFullYear(), instant.getMonth(), instant.getDate()))
