/**
 * POST /api/documents/:id/permission-requests
 * 提交权限申请（PRD §6.3.8 第4节）
 *
 * type=1 申请阅读（无任何权限的用户）
 * type=2 申请编辑（已有可阅读权限的用户）
 *
 * 规则：
 * - 文档必须已发布
 * - 申请人不能是归属人
 * - 不能已拥有目标权限
 * - 有未处理的同类申请时拒绝
 * - 成功后通知归属人（M14 或 M15）
 */
import { prisma } from '~/server/utils/prisma'
import { createNotification } from '~/server/utils/notify'
import { writeLog } from '~/server/utils/operation-log'
import { LOG_ACTIONS } from '~/server/constants/log-actions'
import { NOTIFICATION_TEMPLATES } from '~/server/constants/notification-templates'
import { submitPermissionRequestSchema } from '~/server/schemas/permission-request'
import { generateId } from '~/server/utils/snowflake'
import {
  INVALID_PARAMS,
  DOCUMENT_NOT_FOUND,
  DOCUMENT_STATUS_INVALID,
  PERMISSION_REQUEST_PENDING_EXISTS,
  PERMISSION_REQUEST_ALREADY_HAS,
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

  const body = await readValidatedBody(event, submitPermissionRequestSchema.parse)

  const doc = await prisma.doc_documents.findFirst({
    where: { id: docId, deleted_at: null },
    select: { id: true, title: true, status: true, owner_user_id: true, group_id: true },
  })
  if (!doc) return fail(event, 404, DOCUMENT_NOT_FOUND, '文档不存在')
  if (doc.status !== 4) return fail(event, 409, DOCUMENT_STATUS_INVALID, '仅已发布文档可申请权限')

  // 不能是归属人自己
  if (Number(doc.owner_user_id) === user.id) {
    return fail(event, 400, PERMISSION_REQUEST_ALREADY_HAS, '您是该文档的归属人，已拥有所有权限')
  }

  // 检查是否已有相关权限
  const existingPerm = await prisma.doc_document_permissions.findFirst({
    where: { document_id: docId, user_id: BigInt(user.id), deleted_at: null },
    select: { permission: true },
  })
  if (body.type === 2 && existingPerm && existingPerm.permission <= 2) {
    return fail(event, 400, PERMISSION_REQUEST_ALREADY_HAS, '您已拥有编辑权限，无需申请')
  }
  if (body.type === 1 && existingPerm) {
    return fail(event, 400, PERMISSION_REQUEST_ALREADY_HAS, '您已拥有该文档的访问权限')
  }

  // 是否已有未处理的同类申请
  const pending = await prisma.doc_permission_requests.findFirst({
    where: { document_id: docId, user_id: BigInt(user.id), type: body.type, status: 1 },
  })
  if (pending) {
    return fail(event, 409, PERMISSION_REQUEST_PENDING_EXISTS, '已有待处理的相同类型申请，请等待归属人处理')
  }

  // 创建申请记录
  const reqId = generateId()
  await prisma.doc_permission_requests.create({
    data: {
      id: BigInt(reqId),
      document_id: docId,
      user_id: BigInt(user.id),
      type: body.type,
      reason: body.reason ?? null,
      status: 1,
    },
  })

  // 通知归属人
  const ownerUser = await prisma.doc_users.findFirst({
    where: { id: doc.owner_user_id },
    select: { id: true },
  })
  if (ownerUser) {
    if (body.type === 1) {
      await createNotification(
        NOTIFICATION_TEMPLATES.M14.build({
          toUserId: Number(ownerUser.id),
          applicant: user.name,
          fileName: doc.title,
				fileId: doc.id,
				requestId: reqId,
        }),
      )
    } else {
      await createNotification(
        NOTIFICATION_TEMPLATES.M15.build({
          toUserId: Number(ownerUser.id),
          applicant: user.name,
          fileName: doc.title,
				fileId: doc.id,
				requestId: reqId,
          reason: body.reason ?? '（未填写理由）',
        }),
      )
    }
  }

  const permLabel = body.type === 1 ? '阅读' : '编辑'

  await writeLog({
    actorUserId: user.id,
    action: LOG_ACTIONS.SHARE_REQUEST_EDIT,
    targetType: 'document',
    targetId: Number(docId),
    documentId: Number(docId),
    groupId: doc.group_id ? Number(doc.group_id) : undefined,
    detail: { desc: `申请${permLabel}权限「${doc.title}」`, type: body.type },
  })

  return ok({ requestId: reqId.toString() }, `${permLabel}权限申请已发送，等待归属人处理`)
})
