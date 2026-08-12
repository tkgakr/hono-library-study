import { describe, expect, test, vi } from 'bun:test'
import { bookUpdateUsecase } from '@application/usecase/book/bookUpdateUsecase'
import { bookSaveOperations, getBookSchema, validatedUpdateBookSchema } from '@domain/model/book/book'
import type { ResultCode } from '@domain/model/generic/generic'
import { ResultCodes } from '@domain/model/generic/generic'
import type { IBookRepository } from '@domain/repository/book/bookRepository'
import { mockBookRepository, mockGetBook, mockLogger } from '@test/fixtures/data/book'

const inactiveBook = getBookSchema.parse({ ...mockGetBook, isActive: false })
const otherBook = getBookSchema.parse({ ...mockGetBook, id: '550e8400-e29b-41d4-a716-446655440001' })

const successRepository: IBookRepository = {
  ...mockBookRepository,
  fetchDetail: vi.fn().mockResolvedValue({ value: mockGetBook }),
  findByTitle: vi.fn().mockResolvedValue({ value: [], total: 0 }),
  save: vi.fn().mockResolvedValue(true),
}

const rpCase: Record<string, IBookRepository> = {
  正常: successRepository,
  自分自身のみ重複: {
    ...successRepository,
    findByTitle: vi.fn().mockResolvedValue({ value: [mockGetBook], total: 1 }),
  },
  未存在: { ...successRepository, fetchDetail: vi.fn().mockResolvedValue({ value: null }) },
  無効状態: { ...successRepository, fetchDetail: vi.fn().mockResolvedValue({ value: inactiveBook }) },
  タイトル重複: { ...successRepository, findByTitle: vi.fn().mockResolvedValue({ value: [otherBook], total: 1 }) },
  取得例外: { ...successRepository, fetchDetail: vi.fn().mockRejectedValue(new Error('test error')) },
  重複チェック例外: { ...successRepository, findByTitle: vi.fn().mockRejectedValue(new Error('test error')) },
  保存失敗: { ...successRepository, save: vi.fn().mockResolvedValue(false) },
  保存例外: { ...successRepository, save: vi.fn().mockRejectedValue(new Error('test error')) },
}

const id = mockGetBook.id
const validatedEntity = validatedUpdateBookSchema.parse({ title: '坊っちゃん' })

describe('bookUpdateUsecase のテスト', () => {
  test.each<{ caseName: string; expected: { success: boolean; code: ResultCode } }>([
    { caseName: '正常', expected: { success: true, code: ResultCodes.SUCCESS } },
    { caseName: '自分自身のみ重複', expected: { success: true, code: ResultCodes.SUCCESS } },
    { caseName: '未存在', expected: { success: false, code: ResultCodes.BOOK_NOT_FOUND } },
    { caseName: '無効状態', expected: { success: false, code: ResultCodes.BOOK_INVALID_STATE } },
    { caseName: 'タイトル重複', expected: { success: false, code: ResultCodes.BOOK_ALREADY_EXISTS } },
    { caseName: '取得例外', expected: { success: false, code: ResultCodes.BOOK_FETCH_FAILED } },
    { caseName: '重複チェック例外', expected: { success: false, code: ResultCodes.BOOK_DUPLICATE_CHECK_FAILED } },
    { caseName: '保存失敗', expected: { success: false, code: ResultCodes.BOOK_SAVE_FAILED } },
    { caseName: '保存例外', expected: { success: false, code: ResultCodes.BOOK_SAVE_FAILED } },
  ])('$caseName の場合に $expected.success となること', async ({ caseName, expected }) => {
    const repository = rpCase[caseName] ?? mockBookRepository
    const result = await bookUpdateUsecase(repository, mockLogger, id, validatedEntity)

    expect(result.isOk()).toBe(expected.success)
    if (result.isErr()) expect(result.error.code).toBe(expected.code)
    expect(repository.fetchDetail).toHaveBeenCalledWith(id)
  })

  test('更新可能な場合に UpdatedBook コマンドで保存されること', async () => {
    const repository = { ...successRepository, save: vi.fn().mockResolvedValue(true) }
    const result = await bookUpdateUsecase(repository, mockLogger, id, validatedEntity)

    expect(result.isOk()).toBe(true)
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ operation: bookSaveOperations.UPDATE, id, title: '坊っちゃん' }),
    )
  })

  test('無効状態の場合に更新操作であることがエラーに含まれること', async () => {
    // save は spread で共有されるため、呼び出し検証用に新しいモックを用意する
    const repository: IBookRepository = {
      ...successRepository,
      fetchDetail: vi.fn().mockResolvedValue({ value: inactiveBook }),
      save: vi.fn().mockResolvedValue(true),
    }
    const result = await bookUpdateUsecase(repository, mockLogger, id, validatedEntity)

    expect(result.isErr()).toBe(true)
    if (result.isErr()) expect(result.error.args).toEqual({ operation: '更新' })
    expect(repository.save).not.toHaveBeenCalled()
  })
})
