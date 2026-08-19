import { describe, expect, test, vi } from 'bun:test'
import { loanGetListUsecase } from '@application/usecase/loan/loanGetListUsecase'
import type { CalendarDate } from '@core/core'
import { toCalendarDate } from '@core/core'
import type { ResultCode } from '@domain/model/generic/generic'
import { ResultCodes } from '@domain/model/generic/generic'
import type { ListData } from '@domain/model/generic/repositoryData'
import type { LoanListItem } from '@domain/model/loan/loanListItem'
import { validatedGetListLoanSearchConditionsSchema } from '@domain/model/loan/loanSearchConditions'
import type { ILoanRepository } from '@domain/repository/loan/loanRepository'
import { mockLoanListItem, mockLoanRepository, mockLogger } from '@test/fixtures/data/loan'
import { mockGetMember } from '@test/fixtures/data/member'

const listData: ListData<LoanListItem> = { value: [mockLoanListItem], total: 1 }
const emptyData: ListData<LoanListItem> = { value: [], total: 0 }

const rpCase: Record<string, ILoanRepository> = {
  正常: { ...mockLoanRepository, fetchListWithRelations: vi.fn().mockResolvedValue(listData) },
  ゼロ件: { ...mockLoanRepository, fetchListWithRelations: vi.fn().mockResolvedValue(emptyData) },
  例外: { ...mockLoanRepository, fetchListWithRelations: vi.fn().mockRejectedValue(new Error('test error')) },
}

const searchConditions = validatedGetListLoanSearchConditionsSchema.parse({
  parameters: { memberId: mockGetMember.id },
  paging: { limit: 10, offset: 0 },
  sort: { orderBy: [{ column: 'loanedOn', order: 'desc' }] },
})

describe('loanGetListUsecase のテスト', () => {
  test.each<{ caseName: string; expected: { success: boolean; code: ResultCode; data?: ListData<LoanListItem> } }>([
    { caseName: '正常', expected: { success: true, code: ResultCodes.SUCCESS, data: listData } },
    { caseName: 'ゼロ件', expected: { success: true, code: ResultCodes.SUCCESS, data: emptyData } },
    { caseName: '例外', expected: { success: false, code: ResultCodes.LOAN_LIST_FAILED } },
  ])('$caseName の場合に $expected.success となること', async ({ caseName, expected }) => {
    const repository = rpCase[caseName] ?? mockLoanRepository
    const result = await loanGetListUsecase(repository, searchConditions, mockLogger)

    expect(result.isOk()).toBe(expected.success)
    if (result.isOk() && expected.data) expect(result.value).toEqual(expected.data)
    if (result.isErr()) expect(result.error.code).toBe(expected.code)
    expect(repository.fetchListWithRelations).toHaveBeenCalledWith(expect.any(Date), searchConditions)
  })

  // ステータス算出の基準日は「時刻を落とした今日」であること（期限当日の誤判定を防ぐ規約）
  test('repository には時刻を落とした今日が渡されること', async () => {
    // 引数はモック実装で直接捕捉する（mock.calls のインデックスアクセスは undefined 混じりの型になるため）
    let today: CalendarDate | undefined
    const repository: ILoanRepository = {
      ...mockLoanRepository,
      fetchListWithRelations: vi.fn((received: CalendarDate) => {
        today = received
        return Promise.resolve(listData)
      }),
    }
    await loanGetListUsecase(repository, searchConditions, mockLogger)

    expect(today).toBeDefined()
    if (today === undefined) return
    expect(today).toEqual(toCalendarDate(new Date()))
    expect(today.getUTCHours()).toBe(0)
    expect(today.getUTCMinutes()).toBe(0)
    expect(today.getUTCSeconds()).toBe(0)
    expect(today.getUTCMilliseconds()).toBe(0)
  })
})
