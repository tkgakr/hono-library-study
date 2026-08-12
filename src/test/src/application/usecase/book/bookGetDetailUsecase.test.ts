import { describe, expect, test, vi } from 'bun:test'
import { bookGetDetailUsecase } from '@application/usecase/book/bookGetDetailUsecase'
import type { GetBook } from '@domain/model/book/book'
import type { ResultCode } from '@domain/model/generic/generic'
import { ResultCodes } from '@domain/model/generic/generic'
import type { EntityData } from '@domain/model/generic/repositoryData'
import type { IBookRepository } from '@domain/repository/book/bookRepository'
import { mockBookRepository, mockGetBook, mockLogger } from '@test/fixtures/data/book'

const entityData: EntityData<GetBook> = { value: mockGetBook }
const emptyData: EntityData<GetBook> = { value: null }

const rpCase: Record<string, IBookRepository> = {
  正常: { ...mockBookRepository, fetchDetail: vi.fn().mockResolvedValue(entityData) },
  未存在: { ...mockBookRepository, fetchDetail: vi.fn().mockResolvedValue(emptyData) },
  例外: { ...mockBookRepository, fetchDetail: vi.fn().mockRejectedValue(new Error('test error')) },
}

const id = mockGetBook.id

describe('bookGetDetailUsecase のテスト', () => {
  test.each<{ caseName: string; expected: { success: boolean; code: ResultCode; data?: EntityData<GetBook> } }>([
    { caseName: '正常', expected: { success: true, code: ResultCodes.SUCCESS, data: entityData } },
    { caseName: '未存在', expected: { success: false, code: ResultCodes.BOOK_NOT_FOUND } },
    { caseName: '例外', expected: { success: false, code: ResultCodes.BOOK_FETCH_FAILED } },
  ])('$caseName の場合に $expected.success となること', async ({ caseName, expected }) => {
    const repository = rpCase[caseName] ?? mockBookRepository
    const result = await bookGetDetailUsecase(id, repository, mockLogger)

    expect(result.isOk()).toBe(expected.success)
    if (result.isOk() && expected.data) expect(result.value).toEqual(expected.data)
    if (result.isErr()) expect(result.error.code).toBe(expected.code)
    expect(repository.fetchDetail).toHaveBeenCalledWith(id)
  })
})
