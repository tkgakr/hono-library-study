import { vi } from 'bun:test'
import { getMemberSchema } from '@domain/model/member/member'
import type { IMemberRepository } from '@domain/repository/member/memberRepository'

export { mockLogger } from './book'

// 実スキーマで parse して作る → フィクスチャが必ずスキーマ妥当
export const mockGetMember = getMemberSchema.parse({
  id: '550e8400-e29b-41d4-a716-446655440001',
  name: '夏目漱石',
  email: 'soseki@example.com',
  isActive: true,
})

// 既定は全メソッドが reject（テストが明示的に成功を opt-in する）
export const mockMemberRepository: IMemberRepository = {
  save: vi.fn().mockRejectedValue(new Error()),
  fetchDetail: vi.fn().mockRejectedValue(new Error()),
  fetchList: vi.fn().mockRejectedValue(new Error()),
  findByEmail: vi.fn().mockRejectedValue(new Error()),
}
