import { describe, expect, test, vi } from 'bun:test'
import { loanCreateUsecase } from '@application/usecase/loan/loanCreateUsecase'
import type { ResultCode } from '@domain/model/generic/generic'
import { ResultCodes } from '@domain/model/generic/generic'
import { loanSaveOperations, validatedCreateLoanSchema } from '@domain/model/loan/loan'
import type { ILoanRepository } from '@domain/repository/loan/loanRepository'
import { mockGetBook } from '@test/fixtures/data/book'
import { mockDueOn, mockLoanedOn, mockLoanRepository, mockLogger } from '@test/fixtures/data/loan'
import { mockGetMember } from '@test/fixtures/data/member'

const rpCase: Record<string, ILoanRepository> = {
  正常: { ...mockLoanRepository, save: vi.fn().mockResolvedValue(true) },
  失敗: { ...mockLoanRepository, save: vi.fn().mockResolvedValue(false) },
  例外: { ...mockLoanRepository, save: vi.fn().mockRejectedValue(new Error('test error')) },
}

const validatedEntity = validatedCreateLoanSchema.parse({
  bookId: mockGetBook.id,
  memberId: mockGetMember.id,
  loanedOn: mockLoanedOn,
  dueOn: mockDueOn,
})

describe('loanCreateUsecase のテスト', () => {
  test.each<{ caseName: string; expected: { success: boolean; code: ResultCode } }>([
    { caseName: '正常', expected: { success: true, code: ResultCodes.SUCCESS } },
    { caseName: '失敗', expected: { success: false, code: ResultCodes.LOAN_SAVE_FAILED } },
    { caseName: '例外', expected: { success: false, code: ResultCodes.LOAN_SAVE_FAILED } },
  ])('$caseName の場合に $expected.success となること', async ({ caseName, expected }) => {
    const repository = rpCase[caseName] ?? mockLoanRepository
    const result = await loanCreateUsecase(repository, mockLogger, validatedEntity)

    expect(result.isOk()).toBe(expected.success)
    if (result.isErr()) expect(result.error.code).toBe(expected.code)
  })

  test('保存コマンドは create 操作として ID を採番して渡されること', async () => {
    const repository: ILoanRepository = { ...mockLoanRepository, save: vi.fn().mockResolvedValue(true) }
    const result = await loanCreateUsecase(repository, mockLogger, validatedEntity)

    expect(result.isOk()).toBe(true)
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: loanSaveOperations.CREATE,
        id: expect.any(String),
        bookId: validatedEntity.bookId,
        memberId: validatedEntity.memberId,
        loanedOn: validatedEntity.loanedOn,
        dueOn: validatedEntity.dueOn,
      }),
    )
  })
})
