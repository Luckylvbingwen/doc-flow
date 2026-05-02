import { z } from 'zod'

/** 发起归属人转移 */
export const initiateTransferSchema = z.object({
  toUserId: z.number().int().positive(),
})

/** 响应归属人转移（接收方操作） */
export const respondTransferSchema = z.object({
  action: z.enum(['accept', 'reject']),
})

export type InitiateTransferBody = z.infer<typeof initiateTransferSchema>
export type RespondTransferBody = z.infer<typeof respondTransferSchema>
