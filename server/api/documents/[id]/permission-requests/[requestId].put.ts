/**
 * PUT /api/documents/:id/permission-requests/:requestId
 * 归属人处理权限申请（同意/拒绝）（PRD §6.3.8 第4节）
 *
 * 同意 type=1 → 创建 doc_document_permissions permission=4(可阅读)
 * 同意 type=2 → 更新 permission=2(可编辑) 或新增
 * 拒绝 → 仅更新 status=3
 *
 * 成功后通知申请人（M16）
 */
import { prisma } from '~/server/utils/prisma'
import { createNotification } from '~/server/utils/notify'
import { writeLog } from '~/server/utils/operation-log'
import { NOTIFICATION_TEMPLATES } from '~/server/constants/notification-templates'
import { LOG_ACTIONS } from '~/server/constants/log-actions'
import { reviewPermissionRequestSchema } from '~/server/schemas/permission-request'
import { generateId } from '~/server/utils/snowflake'
import {
  INVALID_PARAMS,
  DOCUMENT_NOT_FOUND,
  PERMISSION_REQUEST_NOT_FOUND,
  PERMISSION_REQUEST_NOT_OWNER,
  PERMISSION_REQUEST_NOT_PENDING,
} from '~/server/constants/error-codes'

export default defineEventHandler(async (event) => {
  const permErr = await requirePermission(event, 'doc:read')
  if (permErr) return permErr
  const user = event.context.user!

  const idStr = getRouterParam(event, 'id')
  const reqIdStr = getRouterParam(event, 'requestId')
  if (!idStr || !/^\d+$/.test(idStr) || !reqIdStr || !/^\d+$/.test(reqIdStr)) {
    return fail(event, 400, INVALID_PARAMS, '参数非法')
  }
  const docId = BigInt(idStr)
  const reqId = BigInt(reqIdStr)

  const body = await readValidatedBody(event, reviewPermissionRequestSchema.parse)

  const doc = await prisma.doc_documents.findFirst({
    where: { id: docId, deleted_at: null },
    select: { id: true, title: true, owner_user_id: true, group_id: true },
  })
  if (!doc) return fail(event, 404, DOCUMENT_NOT_FOUND, '文档不存在')

  // 仅归属人可处理
  if (Number(doc.owner_user_id) !== user.id) {
    return fail(event, 403, PERMISSION_REQUEST_NOT_OWNER, '仅文档归属人可处理权限申请')
  }

  const req = await prisma.doc_permission_requests.findFirst({
    where: { id: reqId, document_id: docId },
    include: {
      doc_users_doc_permission_requests_user_idTodoc_users: {
        select: { id: true, name: true },
      },
    },
  })
  if (!req) return fail(event, 404, PERMISSION_REQUEST_NOT_FOUND, '申请记录不存在')
  if (req.status !== 1) return fail(event, 409, PERMISSION_REQUEST_NOT_PENDING, '该申请已被处理')

  const applicantId = req.user_id
  const applicantName = req.doc_users_doc_permission_requests_user_idTodoc_users?.name ?? ''
  const permType = req.type === 1 ? '阅读' : '编辑'
  const now = new Date()

  if (body.action === 'approve') {
    // 同意：写/更新 doc_document_permissions
    const targetPermission = req.type === 1 ? 4 : 2  // 4=可阅读, 2=可编辑

    const existing = await prisma.doc_document_permissions.findFirst({
      where: { document_id: docId, user_id: applicantId, deleted_at: null },
      select: { id: true, permission: true },
    })

    await prisma.$transaction(async (tx) => {
      // 更新申请状态
      await tx.doc_permission_requests.update({
        where: { id: reqId },
        data: { status: 2, reviewed_by: BigInt(user.id), reviewed_at: now },
      })

      if (existing) {
        // 已有权限记录 → 更新
        await tx.doc_document_permissions.update({
          where: { id: existing.id },
          data: { permission: targetPermission, updated_at: now },
        })
      } else {
        // 新增权限记录
        await tx.doc_document_permissions.create({
          data: {
            id: BigInt(generateId()),
            document_id: docId,
            user_id: applicantId,
            permission: targetPermission,
            granted_by: BigInt(user.id),
            created_at: now,
            updated_at: now,
          },
        })
      }
    })

    // 通知申请人 M16 已同意
    await createNotification(
      NOTIFICATION_TEMPLATES.M16.build({
        toUserId: Number(applicantId),
        fileName: doc.title,
        permType: permType as '阅读' | '编辑',
        result: '已同意',
      }),
    )

    // 操作日志
    await writeLog({
      actorUserId: user.id,
      action: LOG_ACTIONS.PERMISSION_REQ_APPROVE,
      targetType: 'document',
      targetId: Number(docId),
      groupId: doc.group_id ? Number(doc.group_id) : undefined,
      documentId: Number(docId),
      detail: {
        desc: `同意了「${applicantName}」的${permType}权限申请`,
        applicantId: Number(applicantId),
      },
    })

    return ok(null, '已同意申请')
  } else {
    // 拒绝
    await prisma.doc_permission_requests.update({
      where: { id: reqId },
      data: { status: 3, reviewed_by: BigInt(user.id), reviewed_at: now },
    })

    // 通知申请人 M16 已拒绝
    await createNotification(
      NOTIFICATION_TEMPLATES.M16.build({
        toUserId: Number(applicantId),
        fileName: doc.title,
        permType: permType as '阅读' | '编辑',
        result: '已拒绝',
      }),
    )

    await writeLog({
      actorUserId: user.id,
      action: LOG_ACTIONS.PERMISSION_REQ_REJECT,
      targetType: 'document',
      targetId: Number(docId),
      groupId: doc.group_id ? Number(doc.group_id) : undefined,
      documentId: Number(docId),
      detail: {
        desc: `拒绝了「${applicantName}」的${permType}权限申请`,
        applicantId: Number(applicantId),
      },
    })

    return ok(null, '已拒绝申请')
  }
})
