// リポジトリの戻り値の型
export interface ListData<T> {
  value: T[]
  total: number
}

export interface EntityData<T> {
  value: T | null
}
