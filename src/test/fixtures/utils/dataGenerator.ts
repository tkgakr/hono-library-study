// 元データをディープコピーし、トップレベルの指定項目を上書きしてテストデータを生成する
export const generateTestData = <T extends object>(origin: T, param?: Partial<T>): T => ({
  ...structuredClone(origin),
  ...(param ?? {}),
})
export const generateImitationUuid = (): string => crypto.randomUUID()
