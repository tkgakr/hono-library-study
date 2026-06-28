import z from 'zod'

// 各モデルから使い回す
export const notBlankStringSchema = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0, {
    message: '空白文字のみは指定できません',
  })
