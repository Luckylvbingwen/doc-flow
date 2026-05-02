/**
 * POST /api/documents/:id/transfer
 * 发起归属人转移请求（PRD §6.3.10）
 *
 * 规则：
 * - 仅归属人可发起
 * - 不能转移给自己
 * - 文档有待处理转移时不允许重复发起
 * - 成功后通知目标接收人（M10）
 * - 写操作日志 ownership.request
 * - 过期时间 = 创建后 3 天
 */
import { prisma } from '~/server/utils/prisma'
import { generateId } from '~/server/utils/snowflake'
import { createNotification } from '~/server/utils/notify'
import { writeLog } from '~/server/utils/operation-log'
import { NOTIFICATION_TEMPLATES } from '~/server/constants/notification-templates'
import { LOG_ACTIONS } from '~/server/constants/log-actions'
import { initiateTransferSchema } from '~/server/schemas/ownership-transfer'
import {
  INVALID_PARAMS,
  DOCUMENT_NOT_FOUND,
  OWNERSHIP_TRANSFER_NOT_OWNER,
  OWNERSHIP_TRANSFER_SELF,
  OWNERSHIP_TRANSFER_PENDING_EXISTS,
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

  const body = await readValidatedBody(event, initiateTransferSchema.parse)

  // 查文档
  const doc = await prisma.doc_documents.findFirst({
    where: { id: docId, deleted_at: null },
    select: { id: true, title: true, owner_user_id: true, group_id: true, group_name: true },
  })
  if (!doc) return fail(event, 404, DOCUMENT_NOT_FOUND, '文档不存在')

  // 权限：仅归属人
  if (Number(doc.owner_user_id) !== user.id) {
    return fail(event, 403, OWNERSHIP_TRANSFER_NOT_OWNER, '仅归属人可发起转移请求')
  }

  // 不能转给自己
  if (body.toUserId === user.id) {
    return fail(event, 400, OWNERSHIP_TRANSFER_SELF, '不能将归属权转移给自己')
  }

  // 目标用户存在
  const toUser = await prisma.doc_users.findFirst({
    where: { id: BigInt(body.toUserId) },
    select: { id: true, name: true },
  })
  if (!toUser) return fail(event, 400, INVALID_PARAMS, '目标用户不存在')

  // 是否已有待处理的转移
  const pending = await prisma.doc_ownership_transfers.findFirst({
    where: { document_id: docId, status: 1 },
  })
  if (pending) {
    return fail(event, 409, OWNERSHIP_TRANSFER_PENDING_EXISTS, '该文档已有待处理的转移请求')
  }

  // 过期时间 = 3 天后
  const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)

  const transferId = generateId()
  await prisma.doc_ownership_transfers.create({
    data: {
      id: BigInt(transferId),
      document_id: docId,
      from_user_id: BigInt(user.id),
      to_user_id: BigInt(body.toUserId),
      status: 1,
      expires_at: expiresAt,
    },
  })

  // 通知接收人 M10
  await createNotification(
    NOTIFICATION_TEMPLATES.M10.build({
      toUserId: body.toUserId,
      initiator: user.name,
      fileName: doc.title,
    }),
  )

  // 操作日志
  await writeLog({
    actorUserId: user.id,
    action: LOG_ACTIONS.OWNERSHIP_REQUEST,
    targetType: 'document',
    targetId: Number(docId),
    groupId: doc.group_id ? Number(doc.group_id) : undefined,
    documentId: Number(docId),
    detail: {
      desc: `向「${toUser.name}」发起归属人转移请求`,
      toUserId: body.toUserId,
      toUserName: toUser.name,
    },
  })

  return ok({ transferId: transferId.toString() }, '转移请求已发送')
})
