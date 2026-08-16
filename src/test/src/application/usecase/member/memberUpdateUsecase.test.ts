import { describe, expect, test, vi } from 'bun:test'
import { memberUpdateUsecase } from '@application/usecase/member/memberUpdateUsecase'
import type { ResultCode } from '@domain/model/generic/generic'
import { ResultCodes } from '@domain/model/generic/generic'
import { getMemberSchema, memberSaveOperations, validatedUpdateMemberSchema } from '@domain/model/member/member'
import type { IMemberRepository } from '@domain/repository/member/memberRepository'
import { mockGetMember, mockLogger, mockMemberRepository } from '@test/fixtures/data/member'

const inactiveMember = getMemberSchema.parse({ ...mockGetMember, isActive: false })
const otherMember = getMemberSchema.parse({ ...mockGetMember, id: '550e8400-e29b-41d4-a716-446655440002' })

const successRepository: IMemberRepository = {
  ...mockMemberRepository,
  fetchDetail: vi.fn().mockResolvedValue({ value: mockGetMember }),
  findByEmail: vi.fn().mockResolvedValue({ value: [], total: 0 }),
  save: vi.fn().mockResolvedValue(true),
}

const rpCase: Record<string, IMemberRepository> = {
  正常: successRepository,
  自分自身のみ重複: {
    ...successRepository,
    findByEmail: vi.fn().mockResolvedValue({ value: [mockGetMember], total: 1 }),
  },
  未存在: { ...successRepository, fetchDetail: vi.fn().mockResolvedValue({ value: null }) },
  無効状態: { ...successRepository, fetchDetail: vi.fn().mockResolvedValue({ value: inactiveMember }) },
  メール重複: { ...successRepository, findByEmail: vi.fn().mockResolvedValue({ value: [otherMember], total: 1 }) },
  取得例外: { ...successRepository, fetchDetail: vi.fn().mockRejectedValue(new Error('test error')) },
  重複チェック例外: { ...successRepository, findByEmail: vi.fn().mockRejectedValue(new Error('test error')) },
  保存失敗: { ...successRepository, save: vi.fn().mockResolvedValue(false) },
  保存例外: { ...successRepository, save: vi.fn().mockRejectedValue(new Error('test error')) },
}

const id = mockGetMember.id
const validatedEntity = validatedUpdateMemberSchema.parse({ name: '佐藤次郎', email: 'jiro.sato@example.com' })

describe('memberUpdateUsecase のテスト', () => {
  test.each<{ caseName: string; expected: { success: boolean; code: ResultCode } }>([
    { caseName: '正常', expected: { success: true, code: ResultCodes.SUCCESS } },
    { caseName: '自分自身のみ重複', expected: { success: true, code: ResultCodes.SUCCESS } },
    { caseName: '未存在', expected: { success: false, code: ResultCodes.MEMBER_NOT_FOUND } },
    { caseName: '無効状態', expected: { success: false, code: ResultCodes.MEMBER_INVALID_STATE } },
    { caseName: 'メール重複', expected: { success: false, code: ResultCodes.MEMBER_ALREADY_EXISTS } },
    { caseName: '取得例外', expected: { success: false, code: ResultCodes.MEMBER_FETCH_FAILED } },
    { caseName: '重複チェック例外', expected: { success: false, code: ResultCodes.MEMBER_DUPLICATE_CHECK_FAILED } },
    { caseName: '保存失敗', expected: { success: false, code: ResultCodes.MEMBER_SAVE_FAILED } },
    { caseName: '保存例外', expected: { success: false, code: ResultCodes.MEMBER_SAVE_FAILED } },
  ])('$caseName の場合に $expected.success となること', async ({ caseName, expected }) => {
    const repository = rpCase[caseName] ?? mockMemberRepository
    const result = await memberUpdateUsecase(repository, mockLogger, id, validatedEntity)

    expect(result.isOk()).toBe(expected.success)
    if (result.isErr()) expect(result.error.code).toBe(expected.code)
    expect(repository.fetchDetail).toHaveBeenCalledWith(id)
  })

  test('更新可能な場合に UpdatedMember コマンドで保存されること', async () => {
    const repository = { ...successRepository, save: vi.fn().mockResolvedValue(true) }
    const result = await memberUpdateUsecase(repository, mockLogger, id, validatedEntity)

    expect(result.isOk()).toBe(true)
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: memberSaveOperations.UPDATE,
        id,
        name: '佐藤次郎',
        email: 'jiro.sato@example.com',
      }),
    )
  })

  test('メールアドレス未指定の場合に重複チェックがスキップされること', async () => {
    const repository: IMemberRepository = {
      ...successRepository,
      findByEmail: vi.fn().mockRejectedValue(new Error('test error')),
      save: vi.fn().mockResolvedValue(true),
    }
    const result = await memberUpdateUsecase(
      repository,
      mockLogger,
      id,
      validatedUpdateMemberSchema.parse({ name: '佐藤次郎' }),
    )

    expect(result.isOk()).toBe(true)
    expect(repository.findByEmail).not.toHaveBeenCalled()
  })

  test('無効状態の場合に更新操作であることがエラーに含まれること', async () => {
    // save は spread で共有されるため、呼び出し検証用に新しいモックを用意する
    const repository: IMemberRepository = {
      ...successRepository,
      fetchDetail: vi.fn().mockResolvedValue({ value: inactiveMember }),
      save: vi.fn().mockResolvedValue(true),
    }
    const result = await memberUpdateUsecase(repository, mockLogger, id, validatedEntity)

    expect(result.isErr()).toBe(true)
    if (result.isErr()) expect(result.error.args).toEqual({ operation: '更新' })
    expect(repository.save).not.toHaveBeenCalled()
  })
})
