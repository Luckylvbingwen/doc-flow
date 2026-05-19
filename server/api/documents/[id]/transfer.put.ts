/**
 * PUT /api/documents/:id/transfer
 * 接收方处理归属人转移（同意/拒绝）（PRD §6.3.10 第4节）
 *
 * 规则：
 * - 仅目标接收人可操作
 * - 请求必须为 pending 状态
 * - 同意：更新文档 owner_user_id → 通知双方(M11同意) → 日志
 * - 拒绝：更新请求 status=3 → 通知发起人(M11拒绝) → 日志
 * - 过期检查：PUT 时若已过期则自动关闭并返回 409
 */
import { prisma } from '~/server/utils/prisma'
import { createNotification } from '~/server/utils/notify'
import { writeLog } from '~/server/utils/operation-log'
import { NOTIFICATION_TEMPLATES } from '~/server/constants/notification-templates'
import { LOG_ACTIONS } from '~/server/constants/log-actions'
import { respondTransferSchema } from '~/server/schemas/ownership-transfer'
import {
  INVALID_PARAMS,
  DOCUMENT_NOT_FOUND,
  OWNERSHIP_TRANSFER_NOT_FOUND,
  OWNERSHIP_TRANSFER_NOT_RECIPIENT,
  OWNERSHIP_TRANSFER_NOT_PENDING,
} from '~/server/constants/error-codes'

export default defineEventHandler(async (event) => {
  const permErr = await requirePermission(event, 'doc:read')
  if (permErr) return permErr
  const user = event.context.user!

  const idStr = getRouterParam(event, 'id')
  if (!idStr || !/^\d+$/.test(idStr)) {
    return fail(event, 400, INVALID_PARAMS, '文档 ID 非法')
  }
  const docId = BigInt(idStr)

  const body = await readValidatedBody(event, respondTransferSchema.parse)

  // 查文档
  const doc = await prisma.doc_documents.findFirst({
    where: { id: docId, deleted_at: null },
    select: { id: true, title: true, owner_user_id: true, group_id: true },
  })
  if (!doc) return fail(event, 404, DOCUMENT_NOT_FOUND, '文档不存在')

  // 查最新的待处理转移
  const transfer = await prisma.doc_ownership_transfers.findFirst({
    where: { document_id: docId, status: 1 },
    orderBy: { created_at: 'desc' },
  })
  if (!transfer) return fail(event, 404, OWNERSHIP_TRANSFER_NOT_FOUND, '没有待处理的转移请求')

  // 仅接收人可操作
  if (Number(transfer.to_user_id) !== user.id) {
    return fail(event, 403, OWNERSHIP_TRANSFER_NOT_RECIPIENT, '只有目标接收人可处理此请求')
  }

  // 过期自动关闭
  if (transfer.expires_at < new Date()) {
    await prisma.doc_ownership_transfers.update({
      where: { id: transfer.id },
      data: { status: 4, processed_at: new Date() },
    })
    // 通知发起人已过期
    await createNotification(
      NOTIFICATION_TEMPLATES.M11.build({
        toUserId: Number(transfer.from_user_id),
        fileName: doc.title,
        result: '已过期',
      }),
    )
    return fail(event, 409, OWNERSHIP_TRANSFER_NOT_PENDING, '该转移请求已过期')
  }

  const now = new Date()

  if (body.action === 'accept') {
    // 事务：更新转移状态 + 更新文档归属人
    await prisma.$transaction([
      prisma.doc_ownership_transfers.update({
        where: { id: transfer.id },
        data: { status: 2, processed_at: now },
      }),
      prisma.doc_documents.update({
        where: { id: docId },
        data: { owner_user_id: transfer.to_user_id },
      }),
    ])

    // 通知双方
    await Promise.all([
      // 通知原归属人：已同意
      createNotification(
        NOTIFICATION_TEMPLATES.M11.build({
          toUserId: Number(transfer.from_user_id),
          fileName: doc.title,
          result: '已同意',
        }),
      ),
      // 通知新归属人（自己）：转移成功确认
      createNotification(
        NOTIFICATION_TEMPLATES.M11.build({
          toUserId: user.id,
          fileName: doc.title,
          result: '已同意',
        }),
      ),
    ])

    // 操作日志
    await writeLog({
      actorUserId: user.id,
      action: LOG_ACTIONS.OWNERSHIP_APPROVE,
      targetType: 'document',
      targetId: Number(docId),
      groupId: doc.group_id ? Number(doc.group_id) : undefined,
      documentId: Number(docId),
      detail: {
        desc: `同意了「${user.name}」的归属人转移请求，已成为文档归属人`,
        fromUserId: Number(transfer.from_user_id),
      },
    })

    return ok(null, '已同意，归属权已转移')
  } else {
    // 拒绝
    await prisma.doc_ownership_transfers.update({
      where: { id: transfer.id },
      data: { status: 3, processed_at: now },
    })

    // 通知发起人：已拒绝
    await createNotification(
      NOTIFICATION_TEMPLATES.M11.build({
        toUserId: Number(transfer.from_user_id),
        fileName: doc.title,
        result: '已拒绝',
      }),
    )

    await writeLog({
      actorUserId: user.id,
      action: LOG_ACTIONS.OWNERSHIP_REJECT,
      targetType: 'document',
      targetId: Number(docId),
      groupId: doc.group_id ? Number(doc.group_id) : undefined,
      documentId: Number(docId),
      detail: {
        desc: `拒绝了归属人转移请求`,
        fromUserId: Number(transfer.from_user_id),
      },
    })

    return ok(null, '已拒绝转移请求')
  }
})
