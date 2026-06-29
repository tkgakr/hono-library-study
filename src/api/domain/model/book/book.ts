import { notBlankStringSchema } from '@domain/model/generic/commonSchema'
import z from 'zod'

// (A) 操作種別を const で定義し、型は typeof から参照する
export const bookSaveOperations = {
  CREATE: 'create',
  UPDATE: 'update',
  INACTIVATE: 'inactivate',
  ACTIVATE: 'activate',
} as const

// (B) 取得用スキーマ（DB から読み出した1件を表す）
export const getBookSchema = z
  .object({
    id: z.uuid(),
    title: notBlankStringSchema,
    author: notBlankStringSchema,
    isActive: z.boolean(),
  })
  .brand<'GetBook'>()
export type GetBook = z.infer<typeof getBookSchema>

// (C) 作成：入力（検証済み）→ ドメイン関数 → コマンド型
export const validatedCreateBookSchema = z
  .object({
    title: notBlankStringSchema,
    author: notBlankStringSchema,
  })
  .brand<'ValidatedCreateBook'>()
export type ValidatedCreateBook = z.infer<typeof validatedCreateBookSchema>

export const createdBookSchema = z
  .object({
    operation: z.literal(bookSaveOperations.CREATE),
    id: z.uuid(),
    title: notBlankStringSchema,
    author: notBlankStringSchema,
  })
  .brand<'CreatedBook'>()
export type CreatedBook = z.infer<typeof createdBookSchema>

export const createBook = (entity: ValidatedCreateBook): CreatedBook =>
  createdBookSchema.parse({
    operation: bookSaveOperations.CREATE,
    id: crypto.randomUUID(), // (D) ID採番は domain の create で行う
    title: entity.title,
    author: entity.author,
  })

// (E) 更新：どちらか必須を refine で表現
export const validatedUpdateBookSchema = z
  .object({
    title: notBlankStringSchema.optional(),
    author: notBlankStringSchema.optional(),
  })
  .refine((data) => data.title !== undefined || data.author !== undefined, {
    message: 'title または author のどちらかを指定してください',
  })
  .brand<'ValidatedUpdateBook'>()
export type ValidatedUpdateBook = z.infer<typeof validatedUpdateBookSchema>

export const updatedBookSchema = z
  .object({
    operation: z.literal(bookSaveOperations.UPDATE),
    id: z.uuid(),
    title: notBlankStringSchema.optional(),
    author: notBlankStringSchema.optional(),
  })
  .brand<'UpdatedBook'>()
export type UpdatedBook = z.infer<typeof updatedBookSchema>

export const updateBook = (id: string, entity: ValidatedUpdateBook): UpdatedBook =>
  updatedBookSchema.parse({
    operation: bookSaveOperations.UPDATE,
    id,
    title: entity.title,
    author: entity.author,
  })

// (F) 無効化（論理削除）
export const inactivatedBookSchema = z
  .object({
    operation: z.literal(bookSaveOperations.INACTIVATE),
    id: z.uuid(),
    isActive: z.literal(false),
  })
  .brand<'InactivatedBook'>()
export type InactivatedBook = z.infer<typeof inactivatedBookSchema>

export const inactivateBook = (id: string): InactivatedBook =>
  inactivatedBookSchema.parse({
    operation: bookSaveOperations.INACTIVATE,
    id,
    isActive: false,
  })

// (G) 復元
export const activatedBookSchema = z
  .object({
    operation: z.literal(bookSaveOperations.ACTIVATE),
    id: z.uuid(),
    isActive: z.literal(true),
  })
  .brand<'ActivatedBook'>()
export type ActivatedBook = z.infer<typeof activatedBookSchema>

export const activateBook = (id: string): ActivatedBook =>
  activatedBookSchema.parse({
    operation: bookSaveOperations.ACTIVATE,
    id,
    isActive: true,
  })

// (H) 保存系コマンドの直和型（discriminated union）
export type SaveBook = CreatedBook | UpdatedBook | InactivatedBook | ActivatedBook
