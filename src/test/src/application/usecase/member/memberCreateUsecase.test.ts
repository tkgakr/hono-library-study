import { describe, expect, test, vi } from 'bun:test'
import { memberCreateUsecase } from '@application/usecase/member/memberCreateUsecase'
import type { ResultCode } from '@domain/model/generic/generic'
import { ResultCodes } from '@domain/model/generic/generic'
import { validatedCreateMemberSchema } from '@domain/model/member/member'
import type { IMemberRepository } from '@domain/repository/member/memberRepository'
import { mockGetMember, mockLogger, mockMemberRepository } from '@test/fixtures/data/member'

const successRepository: IMemberRepository = {
  ...mockMemberRepository,
  save: vi.fn().mockResolvedValue(true),
  findByEmail: vi.fn().mockResolvedValue({ value: [], total: 0 }),
}

const rpCase: Record<string, IMemberRepository> = {
  正常: successRepository,
  メールアドレス重複: {
    ...successRepository,
    findByEmail: vi.fn().mockResolvedValue({ value: [mockGetMember], total: 1 }),
  },
  重複チェック例外: { ...successRepository, findByEmail: vi.fn().mockRejectedValue(new Error('test error')) },
  失敗: { ...successRepository, save: vi.fn().mockResolvedValue(false) },
  例外: { ...successRepository, save: vi.fn().mockRejectedValue(new Error('test error')) },
}

describe('memberCreateUsecase のテスト', () => {
  test.each<{ caseName: string; expected: { success: boolean; code: ResultCode } }>([
    { caseName: '正常', expected: { success: true, code: ResultCodes.SUCCESS } },
    { caseName: 'メールアドレス重複', expected: { success: false, code: ResultCodes.MEMBER_ALREADY_EXISTS } },
    { caseName: '重複チェック例外', expected: { success: false, code: ResultCodes.MEMBER_DUPLICATE_CHECK_FAILED } },
    { caseName: '失敗', expected: { success: false, code: ResultCodes.MEMBER_SAVE_FAILED } },
    { caseName: '例外', expected: { success: false, code: ResultCodes.MEMBER_SAVE_FAILED } },
  ])('$caseName の場合に $expected.success となること', async ({ caseName, expected }) => {
    const repository = rpCase[caseName] ?? mockMemberRepository
    const validatedEntity = validatedCreateMemberSchema.parse({ name: '鈴木花子', email: 'hanako.suzuki@example.com' })
    const result = await memberCreateUsecase(repository, mockLogger, validatedEntity)

    expect(result.isOk()).toBe(expected.success)
    if (result.isErr()) expect(result.error.code).toBe(expected.code)
  })
})
