import { describe, expect, test } from 'bun:test'
import {
  createMember,
  getMemberSchema,
  updateMember,
  validatedCreateMemberSchema,
  validatedUpdateMemberSchema,
} from '@domain/model/member/member'
import { getZodErrorPathStrings } from '@infrastructure/middleware/errorHandler'
import { generateImitationUuid } from '@test/fixtures/utils/dataGenerator'
import z from 'zod'

const successGetInput = {
  id: generateImitationUuid(),
  name: '山田太郎',
  email: 'taro.yamada@example.com',
  isActive: true,
}

describe('GetMember のテスト', () => {
  test.each<{ caseName: string; expected: boolean; errParam: string; input: Record<string, unknown> }>([
    { caseName: '正常', expected: true, errParam: '', input: successGetInput },
    { caseName: 'id が UUID 形式以外', expected: false, errParam: 'id', input: { ...successGetInput, id: 'invalid' } },
    { caseName: 'name が空文字', expected: false, errParam: 'name', input: { ...successGetInput, name: '' } },
    { caseName: 'name が空白のみ', expected: false, errParam: 'name', input: { ...successGetInput, name: '  ' } },
    {
      caseName: 'email が形式不正',
      expected: false,
      errParam: 'email',
      input: { ...successGetInput, email: 'invalid' },
    },
    {
      caseName: 'isActive が文字列',
      expected: false,
      errParam: 'isActive',
      input: { ...successGetInput, isActive: 'true' },
    },
  ])('$caseName の場合に expected: $expected となること', ({ expected, errParam, input }) => {
    const result = getMemberSchema.safeParse(input)
    expect(result.success).toBe(expected)
    if (!result.success && result.error instanceof z.ZodError && errParam) {
      expect(getZodErrorPathStrings(result.error)).toContain(errParam)
    }
  })
})

describe('createMember のテスト', () => {
  test('正常時に operation:create と採番された id を持つこと', () => {
    const validated = validatedCreateMemberSchema.parse({ name: '鈴木花子', email: 'hanako.suzuki@example.com' })
    const created = createMember(validated)
    expect(created).toMatchObject({
      operation: 'create',
      id: expect.any(String),
      name: '鈴木花子',
      email: 'hanako.suzuki@example.com',
    })
  })
})

describe('updateMember のテスト', () => {
  test.each<{ caseName: string; input: { name?: string; email?: string } }>([
    { caseName: 'name と email の両方を指定', input: { name: '佐藤次郎', email: 'jiro.sato@example.com' } },
    { caseName: 'name のみ指定', input: { name: '高橋美咲' } },
    { caseName: 'email のみ指定', input: { email: 'misaki.takahashi@example.com' } },
  ])('$caseName の場合に operation:update と渡した id を持つこと', ({ input }) => {
    const id = generateImitationUuid()
    const updated = updateMember(id, validatedUpdateMemberSchema.parse(input))
    expect(updated).toMatchObject({ operation: 'update', id, ...input })
  })

  test('name も email も無いとカスタムエラーになること', () => {
    const result = validatedUpdateMemberSchema.safeParse({})
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.at(0)?.code).toBe('custom')
      expect(result.error.issues.at(0)?.message).toBe('name または email のどちらかを指定してください')
    }
  })
})
