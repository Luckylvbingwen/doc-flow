/**
 * GET /api/documents/:id/transfer
 * 查询文档当前的待处理转移请求状态（前端发起弹窗时用）
 *
 * 返回：
 * - 有待处理 → { pending: true, toUserId, toUserName, expiresAt }
 * - 无待处理 → { pending: false }
 */
import { prisma } from '~/server/utils/prisma'
import { INVALID_PARAMS, DOCUMENT_NOT_FOUND } from '~/server/constants/error-codes'

export default defineEventHandler(async (event) => {
  const permErr = await requirePermission(event, 'doc:read')
  if (permErr) return permErr

  const idStr = getRouterParam(event, 'id')
  if (!idStr || !/^\d+$/.test(idStr)) {
    return fail(event, 400, INVALID_PARAMS, '文档 ID 非法')
  }
  const docId = BigInt(idStr)

  const doc = await prisma.doc_documents.findFirst({
    where: { id: docId, deleted_at: null },
    select: { id: true },
  })
  if (!doc) return fail(event, 404, DOCUMENT_NOT_FOUND, '文档不存在')

  const transfer = await prisma.doc_ownership_transfers.findFirst({
    where: { document_id: docId, status: 1 },
    include: {
      doc_users_doc_ownership_transfers_to_user_idTodoc_users: {
        select: { id: true, name: true },
      },
    },
    orderBy: { created_at: 'desc' },
  })

  if (!transfer) return ok({ pending: false })

  // 自动处理过期（查询时顺手检查）
  if (transfer.expires_at < new Date()) {
    await prisma.doc_ownership_transfers.update({
      where: { id: transfer.id },
      data: { status: 4, processed_at: new Date() },
    })
    return ok({ pending: false })
  }

  const toUser = transfer.doc_users_doc_ownership_transfers_to_user_idTodoc_users

  return ok({
    pending: true,
    transferId: transfer.id.toString(),
    toUserId: Number(transfer.to_user_id),
    toUserName: toUser?.name ?? '',
    expiresAt: transfer.expires_at.getTime(),
    createdAt: transfer.created_at.getTime(),
  })
})
