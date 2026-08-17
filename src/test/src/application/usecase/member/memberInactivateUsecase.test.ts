import { describe, expect, test, vi } from 'bun:test'
import { memberInactivateUsecase } from '@application/usecase/member/memberInactivateUsecase'
import type { ResultCode } from '@domain/model/generic/generic'
import { ResultCodes } from '@domain/model/generic/generic'
import { getMemberSchema, memberSaveOperations } from '@domain/model/member/member'
import type { IMemberRepository } from '@domain/repository/member/memberRepository'
import { mockGetMember, mockLogger, mockMemberRepository } from '@test/fixtures/data/member'

const inactiveMember = getMemberSchema.parse({ ...mockGetMember, isActive: false })

const successRepository: IMemberRepository = {
  ...mockMemberRepository,
  fetchDetail: vi.fn().mockResolvedValue({ value: mockGetMember }),
  save: vi.fn().mockResolvedValue(true),
}

const rpCase: Record<string, IMemberRepository> = {
  正常: successRepository,
  既に無効: {
    ...successRepository,
    fetchDetail: vi.fn().mockResolvedValue({ value: inactiveMember }),
  },
  未存在: { ...successRepository, fetchDetail: vi.fn().mockResolvedValue({ value: null }) },
  取得例外: { ...successRepository, fetchDetail: vi.fn().mockRejectedValue(new Error('test error')) },
  保存失敗: { ...successRepository, save: vi.fn().mockResolvedValue(false) },
  保存例外: { ...successRepository, save: vi.fn().mockRejectedValue(new Error('test error')) },
}

const id = mockGetMember.id

describe('memberInactivateUsecase のテスト', () => {
  test.each<{ caseName: string; expected: { success: boolean; code: ResultCode } }>([
    { caseName: '正常', expected: { success: true, code: ResultCodes.SUCCESS } },
    { caseName: '既に無効', expected: { success: true, code: ResultCodes.SUCCESS } },
    { caseName: '未存在', expected: { success: false, code: ResultCodes.MEMBER_NOT_FOUND } },
    { caseName: '取得例外', expected: { success: false, code: ResultCodes.MEMBER_FETCH_FAILED } },
    { caseName: '保存失敗', expected: { success: false, code: ResultCodes.MEMBER_SAVE_FAILED } },
    { caseName: '保存例外', expected: { success: false, code: ResultCodes.MEMBER_SAVE_FAILED } },
  ])('$caseName の場合に $expected.success となること', async ({ caseName, expected }) => {
    const repository = rpCase[caseName] ?? mockMemberRepository
    const result = await memberInactivateUsecase(repository, mockLogger, id)

    expect(result.isOk()).toBe(expected.success)
    if (result.isErr()) expect(result.error.code).toBe(expected.code)
    expect(repository.fetchDetail).toHaveBeenCalledWith(id)
  })

  test('無効化可能な場合に InactivatedMember コマンドで保存されること', async () => {
    const repository = { ...successRepository, save: vi.fn().mockResolvedValue(true) }
    const result = await memberInactivateUsecase(repository, mockLogger, id)

    expect(result.isOk()).toBe(true)
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ operation: memberSaveOperations.INACTIVATE, id, isActive: false }),
    )
  })

  test('未存在の場合に保存されないこと', async () => {
    const repository: IMemberRepository = {
      ...successRepository,
      fetchDetail: vi.fn().mockResolvedValue({ value: null }),
      save: vi.fn().mockResolvedValue(true),
    }
    const result = await memberInactivateUsecase(repository, mockLogger, id)

    expect(result.isErr()).toBe(true)
    expect(repository.save).not.toHaveBeenCalled()
  })
})
