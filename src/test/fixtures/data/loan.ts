import { vi } from 'bun:test'
import { getLoanSchema, loanStatuses } from '@domain/model/loan/loan'
import { loanListItemSchema } from '@domain/model/loan/loanListItem'
import type { ILoanRepository } from '@domain/repository/loan/loanRepository'

export { mockLogger } from './book'

// 貸出は book / member を参照するため、ID は各フィクスチャの実体に合わせる
const mockBookId = '550e8400-e29b-41d4-a716-446655440000'
const mockMemberId = '550e8400-e29b-41d4-a716-446655440001'
export const mockLoanId = '550e8400-e29b-41d4-a716-446655440002'

// ステータスは日付から導く派生値なので、日付は固定値で持つ（テスト側で「今日」を決める）
export const mockLoanedOn = new Date('2026-07-01')
export const mockDueOn = new Date('2026-07-15')

// 実スキーマで parse して作る → フィクスチャが必ずスキーマ妥当
export const mockGetLoan = getLoanSchema.parse({
  id: mockLoanId,
  bookId: mockBookId,
  memberId: mockMemberId,
  loanedOn: mockLoanedOn,
  dueOn: mockDueOn,
  returnedOn: null,
})

// 一覧の1行（join 済み）。status は repository が算出した結果を模した固定値
export const mockLoanListItem = loanListItemSchema.parse({
  id: mockLoanId,
  bookTitle: '吾輩は猫である',
  memberName: '山田太郎',
  loanedOn: mockLoanedOn,
  dueOn: mockDueOn,
  returnedOn: null,
  status: loanStatuses.ON_LOAN,
})

// 既定は全メソッドが reject（テストが明示的に成功を opt-in する）
export const mockLoanRepository: ILoanRepository = {
  save: vi.fn().mockRejectedValue(new Error()),
  fetchDetail: vi.fn().mockRejectedValue(new Error()),
  fetchListWithRelations: vi.fn().mockRejectedValue(new Error()),
}
