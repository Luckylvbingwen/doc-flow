/**
 * POST /api/groups/:id/references
 * 添加文档引用（批量，PRD §6.10.3）
 *
 * 规则：
 * - 仅组管理员可操作
 * - 不能引用本组的文档
 * - 源文档必须已发布
 * - 去重：已引用的跳过（不报错）
 * - 成功创建的每条记录返回
 */
import { prisma } from '~/server/utils/prisma'
import { requireMemberPermission } from '~/server/utils/group-permission'
import { addReferencesSchema } from '~/server/schemas/document-reference'
import { generateId } from '~/server/utils/snowflake'
import {
  INVALID_PARAMS,
  GROUP_NOT_FOUND,
  REFERENCE_SELF_GROUP,
  REFERENCE_NOT_PUBLISHED,
} from '~/server/constants/error-codes'

export default defineEventHandler(async (event) => {
  const permErr = await requirePermission(event, 'doc:read')
  if (permErr) return permErr
  const user = event.context.user!

  const idStr = getRouterParam(event, 'id')
  if (!idStr || !/^\d+$/.test(idStr)) {
    return fail(event, 400, INVALID_PARAMS, '组 ID 非法')
  }
  const groupId = BigInt(idStr)

  // 组管理员权限校验
  const adminErr = await requireMemberPermission(event, Number(groupId), 1)
  if (adminErr) return adminErr

  const group = await prisma.doc_groups.findFirst({
    where: { id: groupId },
    select: { id: true },
  })
  if (!group) return fail(event, 404, GROUP_NOT_FOUND, '组不存在')

  const body = await readValidatedBody(event, addReferencesSchema.parse)

  // 查这些文档的详细信息
  const docs = await prisma.doc_documents.findMany({
    where: {
      id: { in: body.documentIds.map(id => BigInt(id)) },
      deleted_at: null,
    },
    select: { id: true, title: true, status: true, group_id: true },
  })

  // 验证：本组文档 & 已发布检查
  for (const doc of docs) {
    if (doc.group_id && doc.group_id === groupId) {
      return fail(event, 400, REFERENCE_SELF_GROUP, `文档《${doc.title}》属于本组，不能引用本组文档`)
    }
    if (doc.status !== 4) {
      return fail(event, 400, REFERENCE_NOT_PUBLISHED, `文档《${doc.title}》未发布，不能被引用`)
    }
  }

  // 查已有引用（去重用）
  const existingRefs = await prisma.doc_document_references.findMany({
    where: {
      target_group_id: groupId,
      source_document_id: { in: docs.map(d => d.id) },
    },
    select: { source_document_id: true },
  })
  const existingIds = new Set(existingRefs.map(r => r.source_document_id.toString()))

  // 过滤出未引用的
  const toCreate = docs.filter(d => !existingIds.has(d.id.toString()))

  if (toCreate.length === 0) {
    return ok({ created: 0, skipped: docs.length }, '所选文档均已引用')
  }

  // 批量创建
  await prisma.doc_document_references.createMany({
    data: toCreate.map(d => ({
      id: BigInt(generateId()),
      source_document_id: d.id,
      source_group_id: d.group_id!,
      target_group_id: groupId,
      created_by: BigInt(user.id),
      created_at: new Date(),
    })),
  })

  return ok(
    { created: toCreate.length, skipped: docs.length - toCreate.length },
    `成功引用 ${toCreate.length} 个文档${docs.length - toCreate.length > 0 ? `，${docs.length - toCreate.length} 个已跳过` : ''}`,
  )
})
