import { describe, expect, test, vi } from 'bun:test'
import { bookGetListUsecase } from '@application/usecase/book/bookGetListUsecase'
import type { GetBook } from '@domain/model/book/book'
import { validatedGetListBookSearchConditionsSchema } from '@domain/model/book/bookSearchConditions'
import type { ResultCode } from '@domain/model/generic/generic'
import { ResultCodes } from '@domain/model/generic/generic'
import type { ListData } from '@domain/model/generic/repositoryData'
import type { IBookRepository } from '@domain/repository/book/bookRepository'
import { mockBookRepository, mockGetBook, mockLogger } from '@test/fixtures/data/book'

const listData: ListData<GetBook> = { value: [mockGetBook], total: 1 }
const emptyData: ListData<GetBook> = { value: [], total: 0 }

const rpCase: Record<string, IBookRepository> = {
  正常: { ...mockBookRepository, fetchList: vi.fn().mockResolvedValue(listData) },
  ゼロ件: { ...mockBookRepository, fetchList: vi.fn().mockResolvedValue(emptyData) },
  例外: { ...mockBookRepository, fetchList: vi.fn().mockRejectedValue(new Error('test error')) },
}

const searchConditions = validatedGetListBookSearchConditionsSchema.parse({
  parameters: { title: '吾輩', isActive: true },
  paging: { limit: 10, offset: 0 },
  sort: { orderBy: [{ column: 'title', order: 'asc' }] },
})

describe('bookGetListUsecase のテスト', () => {
  test.each<{ caseName: string; expected: { success: boolean; code: ResultCode; data?: ListData<GetBook> } }>([
    { caseName: '正常', expected: { success: true, code: ResultCodes.SUCCESS, data: listData } },
    { caseName: 'ゼロ件', expected: { success: true, code: ResultCodes.SUCCESS, data: emptyData } },
    { caseName: '例外', expected: { success: false, code: ResultCodes.BOOK_LIST_FAILED } },
  ])('$caseName の場合に $expected.success となること', async ({ caseName, expected }) => {
    const repository = rpCase[caseName] ?? mockBookRepository
    const result = await bookGetListUsecase(repository, searchConditions, mockLogger)

    expect(result.isOk()).toBe(expected.success)
    if (result.isOk() && expected.data) expect(result.value).toEqual(expected.data)
    if (result.isErr()) expect(result.error.code).toBe(expected.code)
    expect(repository.fetchList).toHaveBeenCalledWith(searchConditions)
  })
})
