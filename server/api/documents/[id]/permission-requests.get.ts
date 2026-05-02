/**
 * GET /api/documents/:id/permission-requests
 * 查询该文档的待处理权限申请列表（文档归属人查看）
 *
 * 返回：仅 status=1 的未处理申请
 */
import { prisma } from '~/server/utils/prisma'
import {
  INVALID_PARAMS,
  DOCUMENT_NOT_FOUND,
  PERMISSION_REQUEST_NOT_OWNER,
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

  const doc = await prisma.doc_documents.findFirst({
    where: { id: docId, deleted_at: null },
    select: { id: true, owner_user_id: true },
  })
  if (!doc) return fail(event, 404, DOCUMENT_NOT_FOUND, '文档不存在')

  // 仅归属人可查看
  if (Number(doc.owner_user_id) !== user.id) {
    return fail(event, 403, PERMISSION_REQUEST_NOT_OWNER, '仅文档归属人可查看权限申请')
  }

  const requests = await prisma.doc_permission_requests.findMany({
    where: { document_id: docId, status: 1 },
    include: {
      doc_users_doc_permission_requests_user_idTodoc_users: {
        select: { id: true, name: true, avatar_url: true },
      },
    },
    orderBy: { created_at: 'asc' },
  })

  const list = requests.map(r => ({
    id: r.id.toString(),
    userId: Number(r.user_id),
    userName: r.doc_users_doc_permission_requests_user_idTodoc_users?.name ?? '',
    avatarUrl: r.doc_users_doc_permission_requests_user_idTodoc_users?.avatar_url ?? null,
    type: r.type as 1 | 2,
    reason: r.reason,
    createdAt: r.created_at.getTime(),
  }))

  return ok(list)
})
