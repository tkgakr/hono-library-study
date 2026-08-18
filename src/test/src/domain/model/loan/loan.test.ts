import { describe, expect, test } from 'bun:test'
import { toCalendarDate } from '@core/core'
import {
  createLoan,
  getLoanSchema,
  loanStatuses,
  resolveLoanStatus,
  returnLoan,
  validatedCreateLoanSchema,
} from '@domain/model/loan/loan'
import { getZodErrorPathStrings } from '@infrastructure/middleware/errorHandler'
import { generateImitationUuid } from '@test/fixtures/utils/dataGenerator'
import z from 'zod'

const successGetInput = {
  id: generateImitationUuid(),
  bookId: generateImitationUuid(),
  memberId: generateImitationUuid(),
  loanedOn: new Date('2026-07-01'),
  dueOn: new Date('2026-07-15'),
  returnedOn: null,
}

describe('GetLoan のテスト', () => {
  test.each<{ caseName: string; expected: boolean; errParam: string; input: Record<string, unknown> }>([
    { caseName: '正常', expected: true, errParam: '', input: successGetInput },
    { caseName: 'id が UUID 形式以外', expected: false, errParam: 'id', input: { ...successGetInput, id: 'invalid' } },
    {
      caseName: 'bookId が UUID 形式以外',
      expected: false,
      errParam: 'bookId',
      input: { ...successGetInput, bookId: 'invalid' },
    },
    {
      caseName: 'memberId が UUID 形式以外',
      expected: false,
      errParam: 'memberId',
      input: { ...successGetInput, memberId: 'invalid' },
    },
    {
      caseName: 'loanedOn が文字列',
      expected: false,
      errParam: 'loanedOn',
      input: { ...successGetInput, loanedOn: '2026-07-01' },
    },
    {
      caseName: 'returnedOn に日付を指定',
      expected: true,
      errParam: '',
      input: { ...successGetInput, returnedOn: new Date('2026-07-10') },
    },
    {
      caseName: 'returnedOn が undefined',
      expected: false,
      errParam: 'returnedOn',
      input: { ...successGetInput, returnedOn: undefined },
    },
  ])('$caseName の場合に expected: $expected となること', ({ expected, errParam, input }) => {
    const result = getLoanSchema.safeParse(input)
    expect(result.success).toBe(expected)
    if (!result.success && result.error instanceof z.ZodError && errParam) {
      expect(getZodErrorPathStrings(result.error)).toContain(errParam)
    }
  })
})

describe('ValidatedCreateLoan のテスト', () => {
  const successCreateInput = {
    bookId: generateImitationUuid(),
    memberId: generateImitationUuid(),
    loanedOn: new Date('2026-07-01'),
    dueOn: new Date('2026-07-15'),
  }

  test.each<{ caseName: string; expected: boolean; errParam: string; input: Record<string, unknown> }>([
    { caseName: '正常', expected: true, errParam: '', input: successCreateInput },
    {
      caseName: 'dueOn が loanedOn と同日',
      expected: true,
      errParam: '',
      input: { ...successCreateInput, dueOn: new Date('2026-07-01') },
    },
    {
      caseName: 'dueOn が loanedOn より前',
      expected: false,
      errParam: 'dueOn',
      input: { ...successCreateInput, dueOn: new Date('2026-06-30') },
    },
  ])('$caseName の場合に expected: $expected となること', ({ expected, errParam, input }) => {
    const result = validatedCreateLoanSchema.safeParse(input)
    expect(result.success).toBe(expected)
    if (!result.success && result.error instanceof z.ZodError && errParam) {
      expect(getZodErrorPathStrings(result.error)).toContain(errParam)
    }
  })

  test('dueOn が loanedOn より前の場合に返却期限のメッセージになること', () => {
    const result = validatedCreateLoanSchema.safeParse({ ...successCreateInput, dueOn: new Date('2026-06-30') })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.at(0)?.code).toBe('custom')
      expect(result.error.issues.at(0)?.message).toBe('返却期限は貸出日以降にしてください')
    }
  })
})

describe('createLoan のテスト', () => {
  test('正常時に operation:create と採番された id を持つこと', () => {
    const input = {
      bookId: generateImitationUuid(),
      memberId: generateImitationUuid(),
      loanedOn: new Date('2026-07-01'),
      dueOn: new Date('2026-07-15'),
    }
    const created = createLoan(validatedCreateLoanSchema.parse(input))
    expect(z.uuid().safeParse(created.id).success).toBe(true)
    expect(created).toMatchObject({ operation: 'create', id: expect.any(String), ...input })
  })
})

describe('returnLoan のテスト', () => {
  test('正常時に operation:return と渡した id・返却日を持つこと', () => {
    const id = generateImitationUuid()
    const returnedOn = new Date('2026-07-10')
    expect(returnLoan(id, returnedOn)).toMatchObject({ operation: 'return', id, returnedOn })
  })

  test('id が UUID 形式以外の場合に例外になること', () => {
    expect(() => returnLoan('invalid', new Date('2026-07-10'))).toThrow(z.ZodError)
  })
})

describe('resolveLoanStatus のテスト', () => {
  test.each<{ caseName: string; dueOn: Date; returnedOn: Date | null; today: Date; expected: string }>([
    {
      caseName: '返却日がある（期限内）',
      dueOn: new Date('2026-07-15'),
      returnedOn: new Date('2026-07-10'),
      today: new Date('2026-07-20T09:00:00'),
      expected: loanStatuses.RETURNED,
    },
    {
      caseName: '返却日がある（期限超過後の返却）',
      dueOn: new Date('2026-07-15'),
      returnedOn: new Date('2026-07-20'),
      today: new Date('2026-07-21T09:00:00'),
      expected: loanStatuses.RETURNED,
    },
    {
      caseName: '未返却で期限より前',
      dueOn: new Date('2026-07-15'),
      returnedOn: null,
      today: new Date('2026-07-14T23:59:00'),
      expected: loanStatuses.ON_LOAN,
    },
    {
      caseName: '未返却で期限当日（延滞にしない境界）',
      dueOn: new Date('2026-07-15'),
      returnedOn: null,
      today: new Date('2026-07-15T23:59:00'),
      expected: loanStatuses.ON_LOAN,
    },
    {
      caseName: '未返却で期限翌日',
      dueOn: new Date('2026-07-15'),
      returnedOn: null,
      today: new Date('2026-07-16T00:00:00'),
      expected: loanStatuses.OVERDUE,
    },
  ])('$caseName の場合に $expected となること', ({ dueOn, returnedOn, today, expected }) => {
    expect(resolveLoanStatus({ dueOn, returnedOn }, toCalendarDate(today))).toBe(expected)
  })
})
