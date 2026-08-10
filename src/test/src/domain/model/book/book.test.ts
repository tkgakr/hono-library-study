import { describe, expect, test } from 'bun:test'
import {
  createBook,
  getBookSchema,
  updateBook,
  validatedCreateBookSchema,
  validatedUpdateBookSchema,
} from '@domain/model/book/book'
import { getZodErrorPathStrings } from '@infrastructure/middleware/errorHandler'
import { generateImitationUuid } from '@test/fixtures/utils/dataGenerator'
import z from 'zod'

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

describe('createBook のテスト', () => {
  test('正常時に operation:create と採番された id を持つこと', () => {
    const validated = validatedCreateBookSchema.parse({ title: '坊っちゃん', author: '夏目漱石' })
    const created = createBook(validated)
    expect(created).toMatchObject({
      operation: 'create',
      id: expect.any(String),
      title: '坊っちゃん',
      author: '夏目漱石',
    })
  })
})

describe('updateBook のテスト', () => {
  test('正常時に operation:update と渡した id を持つこと', () => {
    const id = generateImitationUuid()
    const validated = validatedUpdateBookSchema.parse({ title: '草枕', author: '夏目漱石' })
    const updated = updateBook(id, validated)
    expect(updated).toMatchObject({
      operation: 'update',
      id,
      title: '草枕',
      author: '夏目漱石',
    })
  })

  test.each<{ caseName: string; input: { title?: string; author?: string } }>([
    { caseName: 'title のみ指定', input: { title: '三四郎' } },
    { caseName: 'author のみ指定', input: { author: '森鴎外' } },
  ])('$caseName の場合も更新コマンドが作られること', ({ input }) => {
    const id = generateImitationUuid()
    const updated = updateBook(id, validatedUpdateBookSchema.parse(input))
    expect(updated).toMatchObject({ operation: 'update', id, ...input })
  })

  test('title も author も無いとカスタムエラーになること', () => {
    const result = validatedUpdateBookSchema.safeParse({})
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.at(0)?.code).toBe('custom')
      expect(result.error.issues.at(0)?.message).toBe('title または author のどちらかを指定してください')
    }
  })
})
