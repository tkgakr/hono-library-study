import { describe, expect, test, vi } from 'bun:test'
import { bookActivateUsecase } from '@application/usecase/book/bookActivateUsecase'
import { bookSaveOperations, getBookSchema } from '@domain/model/book/book'
import type { ResultCode } from '@domain/model/generic/generic'
import { ResultCodes } from '@domain/model/generic/generic'
import type { IBookRepository } from '@domain/repository/book/bookRepository'
import { mockBookRepository, mockGetBook, mockLogger } from '@test/fixtures/data/book'

const inactiveBook = getBookSchema.parse({ ...mockGetBook, isActive: false })
const otherBook = getBookSchema.parse({ ...mockGetBook, id: '550e8400-e29b-41d4-a716-446655440001' })

const successRepository: IBookRepository = {
  ...mockBookRepository,
  fetchDetail: vi.fn().mockResolvedValue({ value: inactiveBook }),
  findByTitle: vi.fn().mockResolvedValue({ value: [], total: 0 }),
  save: vi.fn().mockResolvedValue(true),
}

const rpCase: Record<string, IBookRepository> = {
  正常: successRepository,
  自分自身のみ重複: {
    ...successRepository,
    findByTitle: vi.fn().mockResolvedValue({ value: [inactiveBook], total: 1 }),
  },
  未存在: { ...successRepository, fetchDetail: vi.fn().mockResolvedValue({ value: null }) },
  有効状態: { ...successRepository, fetchDetail: vi.fn().mockResolvedValue({ value: mockGetBook }) },
  タイトル重複: { ...successRepository, findByTitle: vi.fn().mockResolvedValue({ value: [otherBook], total: 1 }) },
  取得例外: { ...successRepository, fetchDetail: vi.fn().mockRejectedValue(new Error('test error')) },
  重複チェック例外: { ...successRepository, findByTitle: vi.fn().mockRejectedValue(new Error('test error')) },
  保存失敗: { ...successRepository, save: vi.fn().mockResolvedValue(false) },
  保存例外: { ...successRepository, save: vi.fn().mockRejectedValue(new Error('test error')) },
}

const id = inactiveBook.id

describe('bookActivateUsecase のテスト', () => {
  test.each<{ caseName: string; expected: { success: boolean; code: ResultCode } }>([
    { caseName: '正常', expected: { success: true, code: ResultCodes.SUCCESS } },
    { caseName: '自分自身のみ重複', expected: { success: true, code: ResultCodes.SUCCESS } },
    { caseName: '未存在', expected: { success: false, code: ResultCodes.BOOK_NOT_FOUND } },
    { caseName: '有効状態', expected: { success: false, code: ResultCodes.BOOK_INVALID_STATE } },
    { caseName: 'タイトル重複', expected: { success: false, code: ResultCodes.BOOK_ALREADY_EXISTS } },
    { caseName: '取得例外', expected: { success: false, code: ResultCodes.BOOK_FETCH_FAILED } },
    { caseName: '重複チェック例外', expected: { success: false, code: ResultCodes.BOOK_DUPLICATE_CHECK_FAILED } },
    { caseName: '保存失敗', expected: { success: false, code: ResultCodes.BOOK_SAVE_FAILED } },
    { caseName: '保存例外', expected: { success: false, code: ResultCodes.BOOK_SAVE_FAILED } },
  ])('$caseName の場合に $expected.success となること', async ({ caseName, expected }) => {
    const repository = rpCase[caseName] ?? mockBookRepository
    const result = await bookActivateUsecase(repository, mockLogger, id)

    expect(result.isOk()).toBe(expected.success)
    if (result.isErr()) expect(result.error.code).toBe(expected.code)
    expect(repository.fetchDetail).toHaveBeenCalledWith(id)
  })

  test('復元可能な場合に ActivatedBook コマンドで保存されること', async () => {
    const repository = { ...successRepository, save: vi.fn().mockResolvedValue(true) }
    const result = await bookActivateUsecase(repository, mockLogger, id)

    expect(result.isOk()).toBe(true)
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ operation: bookSaveOperations.ACTIVATE, id, isActive: true }),
    )
  })

  test('有効状態の場合に復元操作であることがエラーに含まれること', async () => {
    const repository: IBookRepository = {
      ...successRepository,
      fetchDetail: vi.fn().mockResolvedValue({ value: mockGetBook }),
      findByTitle: vi.fn().mockResolvedValue({ value: [], total: 0 }),
      save: vi.fn().mockResolvedValue(true),
    }
    const result = await bookActivateUsecase(repository, mockLogger, id)

    expect(result.isErr()).toBe(true)
    if (result.isErr()) expect(result.error.args).toEqual({ operation: '復元' })
    expect(repository.findByTitle).not.toHaveBeenCalled()
    expect(repository.save).not.toHaveBeenCalled()
  })
})
