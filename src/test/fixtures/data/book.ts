import { vi } from 'bun:test'
import { getBookSchema } from '@domain/model/book/book'
import type { IBookRepository } from '@domain/repository/book/bookRepository'

// 実スキーマで parse して作る → フィクスチャが必ずスキーマ妥当
export const mockGetBook = getBookSchema.parse({
  id: '550e8400-e29b-41d4-a716-446655440000',
  title: '吾輩は猫である',
  author: '夏目漱石',
  isActive: true,
})

// 既定は全メソッドが reject（テストが明示的に成功を opt-in する）
export const mockBookRepository: IBookRepository = {
  save: vi.fn().mockRejectedValue(new Error()),
  fetchDetail: vi.fn().mockRejectedValue(new Error()),
  fetchList: vi.fn().mockRejectedValue(new Error()),
  findByTitle: vi.fn().mockRejectedValue(new Error()),
}

export const mockLogger = { debug: vi.fn(), verbose: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
