import { describe, expect, test } from 'bun:test'
import { validatedUpdateBookSchema } from '@domain/model/book/book'

describe('validatedUpdateBookSchema', () => {
  test('title と author の両方が未指定の場合は検証に失敗する', () => {
    const result = validatedUpdateBookSchema.safeParse({})

    expect(result.success).toBe(false)
  })
})
