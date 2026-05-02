import { z } from 'zod'

/** 提交权限申请 */
export const submitPermissionRequestSchema = z.object({
  /** 1申请阅读 2申请编辑 */
  type: z.literal(1).or(z.literal(2)),
  /** 申请理由（仅 type=2 时显示，可选） */
  reason: z.string().max(500).optional(),
})

/** 处理权限申请（归属人操作） */
export const reviewPermissionRequestSchema = z.object({
  action: z.enum(['approve', 'reject']),
})

export type SubmitPermissionRequestBody = z.infer<typeof submitPermissionRequestSchema>
export type ReviewPermissionRequestBody = z.infer<typeof reviewPermissionRequestSchema>
