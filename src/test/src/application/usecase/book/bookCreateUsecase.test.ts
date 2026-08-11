import { describe, expect, test, vi } from 'bun:test'
import { bookCreateUsecase } from '@application/usecase/book/bookCreateUsecase'
import { validatedCreateBookSchema } from '@domain/model/book/book'
import type { ResultCode } from '@domain/model/generic/generic'
import { ResultCodes } from '@domain/model/generic/generic'
import type { IBookRepository } from '@domain/repository/book/bookRepository'
import { mockBookRepository, mockGetBook, mockLogger } from '@test/fixtures/data/book'

const successRepository: IBookRepository = {
  ...mockBookRepository,
  save: vi.fn().mockResolvedValue(true),
  findByTitle: vi.fn().mockResolvedValue({ value: [], total: 0 }),
}

const rpCase: Record<string, IBookRepository> = {
  正常: successRepository,
  タイトル重複: { ...successRepository, findByTitle: vi.fn().mockResolvedValue({ value: [mockGetBook], total: 1 }) },
  失敗: { ...successRepository, save: vi.fn().mockResolvedValue(false) },
  例外: { ...successRepository, save: vi.fn().mockRejectedValue(new Error('test error')) },
}

describe('bookCreateUsecase のテスト', () => {
  test.each<{ caseName: string; expected: { success: boolean; code: ResultCode } }>([
    { caseName: '正常', expected: { success: true, code: ResultCodes.SUCCESS } },
    { caseName: 'タイトル重複', expected: { success: false, code: ResultCodes.BOOK_ALREADY_EXISTS } },
    { caseName: '失敗', expected: { success: false, code: ResultCodes.BOOK_SAVE_FAILED } },
    { caseName: '例外', expected: { success: false, code: ResultCodes.BOOK_SAVE_FAILED } },
  ])('$caseName の場合に $expected.success となること', async ({ caseName, expected }) => {
    const repository = rpCase[caseName] ?? mockBookRepository
    const validatedEntity = validatedCreateBookSchema.parse({ title: '吾輩は猫である', author: '夏目漱石' })
    const result = await bookCreateUsecase(repository, mockLogger, validatedEntity)

    expect(result.isOk()).toBe(expected.success)
    if (result.isErr()) expect(result.error.code).toBe(expected.code)
  })
})
