import { describe, expect, test } from 'bun:test'
import {
  createBook,
  getBookSchema,
  validatedCreateBookSchema,
  validatedUpdateBookSchema,
} from '@domain/model/book/book'
import { getZodErrorPathStrings } from '@infrastructure/middleware/errorHandler'
import { generateImitationUuid } from '@test/fixtures/utils/dataGenerator'
import z from 'zod'

describe('validatedUpdateBookSchema', () => {
  test('title と author の両方が未指定の場合は検証に失敗する', () => {
    const result = validatedUpdateBookSchema.safeParse({})

    expect(result.success).toBe(false)
  })
})

const successGetInput = { id: generateImitationUuid(), title: '吾輩は猫である', author: '夏目漱石', isActive: true }

describe('GetBook のテスト', () => {
  test.each<{ caseName: string; expected: boolean; errParam: string; input: Record<string, unknown> }>([
    { caseName: '正常', expected: true, errParam: '', input: successGetInput },
    { caseName: 'id が UUID 形式以外', expected: false, errParam: 'id', input: { ...successGetInput, id: 'invalid' } },
    { caseName: 'title が空文字', expected: false, errParam: 'title', input: { ...successGetInput, title: '' } },
    { caseName: 'title が空白のみ', expected: false, errParam: 'title', input: { ...successGetInput, title: '  ' } },
    {
      caseName: 'isActive が文字列',
      expected: false,
      errParam: 'isActive',
      input: { ...successGetInput, isActive: 'true' },
    },
  ])('$caseName の場合に expected: $expected となること', ({ expected, errParam, input }) => {
    const result = getBookSchema.safeParse(input)
    expect(result.success).toBe(expected)
    if (!result.success && result.error instanceof z.ZodError && errParam) {
      expect(getZodErrorPathStrings(result.error)).toContain(errParam)
    }
  })
})
