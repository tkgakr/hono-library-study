import { describe, expect, test, vi } from 'bun:test'
import { memberGetListUsecase } from '@application/usecase/member/memberGetListUsecase'
import type { ResultCode } from '@domain/model/generic/generic'
import { ResultCodes } from '@domain/model/generic/generic'
import type { ListData } from '@domain/model/generic/repositoryData'
import type { GetMember } from '@domain/model/member/member'
import { validatedGetListMemberSearchConditionsSchema } from '@domain/model/member/memberSearchConditions'
import type { IMemberRepository } from '@domain/repository/member/memberRepository'
import { mockGetMember, mockLogger, mockMemberRepository } from '@test/fixtures/data/member'

const listData: ListData<GetMember> = { value: [mockGetMember], total: 1 }
const emptyData: ListData<GetMember> = { value: [], total: 0 }

const rpCase: Record<string, IMemberRepository> = {
  正常: { ...mockMemberRepository, fetchList: vi.fn().mockResolvedValue(listData) },
  ゼロ件: { ...mockMemberRepository, fetchList: vi.fn().mockResolvedValue(emptyData) },
  例外: { ...mockMemberRepository, fetchList: vi.fn().mockRejectedValue(new Error('test error')) },
}

const searchConditions = validatedGetListMemberSearchConditionsSchema.parse({
  parameters: { searchFilter: '夏目', isActive: true },
  paging: { limit: 10, offset: 0 },
  sort: { orderBy: [{ column: 'name', order: 'asc' }] },
})

describe('memberGetListUsecase のテスト', () => {
  test.each<{ caseName: string; expected: { success: boolean; code: ResultCode; data?: ListData<GetMember> } }>([
    { caseName: '正常', expected: { success: true, code: ResultCodes.SUCCESS, data: listData } },
    { caseName: 'ゼロ件', expected: { success: true, code: ResultCodes.SUCCESS, data: emptyData } },
    { caseName: '例外', expected: { success: false, code: ResultCodes.MEMBER_LIST_FAILED } },
  ])('$caseName の場合に $expected.success となること', async ({ caseName, expected }) => {
    const repository = rpCase[caseName] ?? mockMemberRepository
    const result = await memberGetListUsecase(repository, searchConditions, mockLogger)

    expect(result.isOk()).toBe(expected.success)
    if (result.isOk() && expected.data) expect(result.value).toEqual(expected.data)
    if (result.isErr()) expect(result.error.code).toBe(expected.code)
    expect(repository.fetchList).toHaveBeenCalledWith(searchConditions)
  })
})
