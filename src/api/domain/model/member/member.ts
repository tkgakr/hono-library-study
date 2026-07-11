import { notBlankStringSchema } from '@domain/model/generic/commonSchema'
import z from 'zod'

// (A) 操作種別を const で定義し、型は typeof から参照する
export const memberSaveOperations = {
  CREATE: 'create',
  UPDATE: 'update',
  INACTIVATE: 'inactivate',
  ACTIVATE: 'activate',
} as const

// (B) 取得用スキーマ（DB から読み出した1件を表す）
export const getMemberSchema = z
  .object({
    id: z.uuid(),
    name: notBlankStringSchema,
    email: z.email(),
    isActive: z.boolean(),
  })
  .brand<'GetMember'>()
export type GetMember = z.infer<typeof getMemberSchema>

// (C) 作成：入力（検証済み）→ ドメイン関数 → コマンド型
export const validatedCreateMemberSchema = z
  .object({
    name: notBlankStringSchema,
    email: z.email(),
  })
  .brand<'ValidatedCreateMember'>()
export type ValidatedCreateMember = z.infer<typeof validatedCreateMemberSchema>

export const createdMemberSchema = z
  .object({
    operation: z.literal(memberSaveOperations.CREATE),
    id: z.uuid(),
    name: notBlankStringSchema,
    email: z.email(),
  })
  .brand<'CreatedMember'>()
export type CreatedMember = z.infer<typeof createdMemberSchema>

export const createMember = (entity: ValidatedCreateMember): CreatedMember =>
  createdMemberSchema.parse({
    operation: memberSaveOperations.CREATE,
    id: crypto.randomUUID(), // (D) ID採番は domain の create で行う
    name: entity.name,
    email: entity.email,
  })

// (E) 更新：どちらか必須を refine で表現
export const validatedUpdateMemberSchema = z
  .object({
    name: notBlankStringSchema.optional(),
    email: z.email().optional(),
  })
  .refine((data) => data.name !== undefined || data.email !== undefined, {
    message: 'name または email のどちらかを指定してください',
  })
  .brand<'ValidatedUpdateMember'>()
export type ValidatedUpdateMember = z.infer<typeof validatedUpdateMemberSchema>

export const updatedMemberSchema = z
  .object({
    operation: z.literal(memberSaveOperations.UPDATE),
    id: z.uuid(),
    name: notBlankStringSchema.optional(),
    email: z.email().optional(),
  })
  .brand<'UpdatedMember'>()
export type UpdatedMember = z.infer<typeof updatedMemberSchema>

export const updateMember = (id: string, entity: ValidatedUpdateMember): UpdatedMember =>
  updatedMemberSchema.parse({
    operation: memberSaveOperations.UPDATE,
    id,
    name: entity.name,
    email: entity.email,
  })

// (F) 無効化（論理削除）
export const inactivatedMemberSchema = z
  .object({
    operation: z.literal(memberSaveOperations.INACTIVATE),
    id: z.uuid(),
    isActive: z.literal(false),
  })
  .brand<'InactivatedMember'>()
export type InactivatedMember = z.infer<typeof inactivatedMemberSchema>

export const inactivateMember = (id: string): InactivatedMember =>
  inactivatedMemberSchema.parse({
    operation: memberSaveOperations.INACTIVATE,
    id,
    isActive: false,
  })

// (G) 復元
export const activatedMemberSchema = z
  .object({
    operation: z.literal(memberSaveOperations.ACTIVATE),
    id: z.uuid(),
    isActive: z.literal(true),
  })
  .brand<'ActivatedMember'>()
export type ActivatedMember = z.infer<typeof activatedMemberSchema>

export const activateMember = (id: string): ActivatedMember =>
  activatedMemberSchema.parse({
    operation: memberSaveOperations.ACTIVATE,
    id,
    isActive: true,
  })

// (H) 保存系コマンドの直和型（discriminated union）
export type SaveMember = CreatedMember | UpdatedMember | InactivatedMember | ActivatedMember
