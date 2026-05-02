/**
 * DELETE /api/groups/:id/references/:refId
 * 取消文档引用（PRD §6.10.4）
 *
 * 规则：
 * - 仅组管理员可操作
 * - 硬删除（引用关系表无软删）
 */
import { prisma } from '~/server/utils/prisma'
import { requireMemberPermission } from '~/server/utils/group-permission'
import {
  INVALID_PARAMS,
  GROUP_NOT_FOUND,
  REFERENCE_NOT_FOUND,
} from '~/server/constants/error-codes'

export default defineEventHandler(async (event) => {
  const permErr = await requirePermission(event, 'doc:read')
  if (permErr) return permErr

  const idStr = getRouterParam(event, 'id')
  const refIdStr = getRouterParam(event, 'refId')
  if (!idStr || !/^\d+$/.test(idStr) || !refIdStr || !/^\d+$/.test(refIdStr)) {
    return fail(event, 400, INVALID_PARAMS, '参数非法')
  }
  const groupId = BigInt(idStr)
  const refId = BigInt(refIdStr)

  // 组管理员权限
  const adminErr = await requireMemberPermission(event, Number(groupId), 1)
  if (adminErr) return adminErr

  const group = await prisma.doc_groups.findFirst({
    where: { id: groupId },
    select: { id: true },
  })
  if (!group) return fail(event, 404, GROUP_NOT_FOUND, '组不存在')

  const ref = await prisma.doc_document_references.findFirst({
    where: { id: refId, target_group_id: groupId },
  })
  if (!ref) return fail(event, 404, REFERENCE_NOT_FOUND, '引用关系不存在')

  await prisma.doc_document_references.delete({ where: { id: refId } })

  return ok(null, '已取消引用')
})
