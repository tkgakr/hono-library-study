import { describe, expect, test, vi } from 'bun:test'
import { memberGetDetailUsecase } from '@application/usecase/member/memberGetDetailUsecase'
import type { ResultCode } from '@domain/model/generic/generic'
import { ResultCodes } from '@domain/model/generic/generic'
import type { EntityData } from '@domain/model/generic/repositoryData'
import type { GetMember } from '@domain/model/member/member'
import type { IMemberRepository } from '@domain/repository/member/memberRepository'
import { mockGetMember, mockLogger, mockMemberRepository } from '@test/fixtures/data/member'

const entityData: EntityData<GetMember> = { value: mockGetMember }
const emptyData: EntityData<GetMember> = { value: null }

const rpCase: Record<string, IMemberRepository> = {
  正常: { ...mockMemberRepository, fetchDetail: vi.fn().mockResolvedValue(entityData) },
  未存在: { ...mockMemberRepository, fetchDetail: vi.fn().mockResolvedValue(emptyData) },
  例外: { ...mockMemberRepository, fetchDetail: vi.fn().mockRejectedValue(new Error('test error')) },
}

const id = mockGetMember.id

describe('memberGetDetailUsecase のテスト', () => {
  test.each<{ caseName: string; expected: { success: boolean; code: ResultCode; data?: EntityData<GetMember> } }>([
    { caseName: '正常', expected: { success: true, code: ResultCodes.SUCCESS, data: entityData } },
    { caseName: '未存在', expected: { success: false, code: ResultCodes.MEMBER_NOT_FOUND } },
    { caseName: '例外', expected: { success: false, code: ResultCodes.MEMBER_FETCH_FAILED } },
  ])('$caseName の場合に $expected.success となること', async ({ caseName, expected }) => {
    const repository = rpCase[caseName] ?? mockMemberRepository
    const result = await memberGetDetailUsecase(id, repository, mockLogger)

    expect(result.isOk()).toBe(expected.success)
    if (result.isOk() && expected.data) expect(result.value).toEqual(expected.data)
    if (result.isErr()) expect(result.error.code).toBe(expected.code)
    expect(repository.fetchDetail).toHaveBeenCalledWith(id)
  })
})
