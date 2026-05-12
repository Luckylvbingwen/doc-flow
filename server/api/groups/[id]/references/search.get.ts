/**
 * GET /api/groups/:id/references/search
 * 搜索可引用的文档（添加引用弹窗文档列表，PRD §6.10.3）
 *
 * 返回当前管理员可见的所有已发布文档（排除当前组已归属的文档和已引用的文档）
 * 每个文档附带 isReferenced 标记（已被本组引用则不可再选）
 */
import { prisma } from '~/server/utils/prisma'
import { Prisma } from '@prisma/client'
import { requireMemberPermission } from '~/server/utils/group-permission'
import { searchReferencesQuerySchema } from '~/server/schemas/document-reference'
import { INVALID_PARAMS, GROUP_NOT_FOUND } from '~/server/constants/error-codes'

export default defineEventHandler(async (event) => {
  const permErr = await requirePermission(event, 'doc:read')
  if (permErr) return permErr
  // const user = event.context.user!

  const idStr = getRouterParam(event, 'id')
  if (!idStr || !/^\d+$/.test(idStr)) {
    return fail(event, 400, INVALID_PARAMS, '组 ID 非法')
  }
  const groupId = BigInt(idStr)

  const group = await prisma.doc_groups.findFirst({
    where: { id: groupId },
    select: { id: true, scope_type: true, scope_ref_id: true, owner_user_id: true },
  })
  if (!group) return fail(event, 404, GROUP_NOT_FOUND, '组不存在')

  // 组管理员才能添加引用
  const adminErr = await requireMemberPermission(event, {
    groupId: Number(groupId),
    scopeType: group.scope_type,
    scopeRefId: group.scope_ref_id != null ? Number(group.scope_ref_id) : null,
    ownerUserId: Number(group.owner_user_id),
  })
  if (adminErr) return adminErr

  const query = await getValidatedQuery(event, searchReferencesQuerySchema.parse)

  // 查当前组已引用的文档 ID（用于标记 isReferenced）
  const existingRefs = await prisma.doc_document_references.findMany({
    where: { target_group_id: groupId },
    select: { source_document_id: true },
  })
  const referencedDocIds = new Set(existingRefs.map(r => r.source_document_id.toString()))

  // 搜索已发布文档（排除本组归属的文档）
  const [rows, total] = await Promise.all([
    prisma.$queryRaw<{
      id: bigint
      title: string
      ext: string | null
      group_id: bigint
      group_name: string
      version_no: string | null
      owner_name: string
      updated_at: Date
    }[]>`
			SELECT
				d.id, d.title, d.ext, d.group_id,
				g.name AS group_name,
				v.version_no,
				u.name AS owner_name,
				d.updated_at
			FROM doc_documents d
			JOIN doc_groups g ON g.id = d.group_id
			JOIN doc_users u ON u.id = d.owner_user_id
			LEFT JOIN doc_document_versions v ON v.id = d.current_version_id
			WHERE d.status = 4
			  AND d.deleted_at IS NULL
			  AND d.group_id IS NOT NULL
			  AND d.group_id != ${groupId}
			  ${query.sourceGroupId ? Prisma.sql`AND d.group_id = ${BigInt(query.sourceGroupId)}` : Prisma.empty}
			  ${query.keyword ? Prisma.sql`AND d.title LIKE ${`%${query.keyword}%`}` : Prisma.empty}
			ORDER BY d.updated_at DESC
			LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}
		`,
    prisma.$queryRaw<[{ cnt: bigint }]>`
			SELECT COUNT(*) AS cnt
			FROM doc_documents d
			WHERE d.status = 4
			  AND d.deleted_at IS NULL
			  AND d.group_id IS NOT NULL
			  AND d.group_id != ${groupId}
			  ${query.sourceGroupId ? Prisma.sql`AND d.group_id = ${BigInt(query.sourceGroupId)}` : Prisma.empty}
			  ${query.keyword ? Prisma.sql`AND d.title LIKE ${`%${query.keyword}%`}` : Prisma.empty}
		`,
  ])

  const list = rows.map(r => ({
    id: Number(r.id),
    title: r.title,
    ext: r.ext ?? '',
    groupId: Number(r.group_id),
    groupName: r.group_name,
    versionNo: r.version_no ?? '-',
    ownerName: r.owner_name,
    updatedAt: r.updated_at.getTime(),
    isReferenced: referencedDocIds.has(r.id.toString()),
  }))

  return ok({
    list,
    total: Number(total[0].cnt),
    page: query.page,
    pageSize: query.pageSize,
  })
})
