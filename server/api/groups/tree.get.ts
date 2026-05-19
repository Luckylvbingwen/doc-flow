/**
 * GET /api/groups/tree
 * 获取完整文档组树（公司层 / 按部门 / 按产品线）
 * 返回结构匹配前端 NavTreeCategory[]
 */
import { prisma } from '~/server/utils/prisma'
import type { GroupTreeRow, DepartmentRow, ProductLineRow } from '~/server/types/group'

interface TreeGroup {
	id: number
	name: string
	fileCount: number
	owner: string
	desc: string | null
	scopeType: number
	scopeRefId: number | null
	parentId: number | null
	children: TreeGroup[]
	files: Array<{ id: number; name: string; type: string }>
}

interface DocFileRow {
	id: bigint
	title: string
	ext: string
	group_id: bigint
}

export default defineEventHandler(async (event) => {
	const permErr = await requirePermission(event, 'doc:read')
	if (permErr) return permErr
	const user = event.context.user!

	// 查询用户可访问的组 ID 集合（成员身份）
	const memberGroupIds = new Set(
		(await prisma.doc_group_members.findMany({
			where: { user_id: BigInt(user.id), deleted_at: null },
			select: { group_id: true },
		})).map(m => Number(m.group_id))
	)

	// 查询用户角色（用于判定 scope 级别穿透）
	const userRoles = await prisma.$queryRaw<Array<{
		code: string
		scope_type: number | null
		scope_ref_id: bigint | number | null
	}>>`
		SELECT r.code, ur.scope_type, ur.scope_ref_id
		FROM sys_user_roles ur
		JOIN sys_roles r ON r.id = ur.role_id AND r.deleted_at IS NULL
		WHERE ur.user_id = ${user.id}
	`
	const isSuperAdmin = userRoles.some(r => r.code === 'super_admin')
	const isCompanyAdmin = userRoles.some(r => r.code === 'company_admin')

	/** 判断用户是否可访问指定组的文件 */
	function canAccessGroupFiles(g: { id: number; scopeType: number; scopeRefId: number | null; ownerUserId?: number }): boolean {
		if (isSuperAdmin) return true
		if (memberGroupIds.has(g.id)) return true
		if (g.ownerUserId && g.ownerUserId === user.id) return true
		if (g.scopeType === 1 && isCompanyAdmin) return true
		if (g.scopeType === 2 && userRoles.some(r => r.code === 'dept_head' && Number(r.scope_ref_id) === g.scopeRefId)) return true
		if (g.scopeType === 3 && userRoles.some(r => r.code === 'pl_head' && Number(r.scope_ref_id) === g.scopeRefId)) return true
		return false
	}

	// 1) 查询所有未删除的组 + 负责人名称 + 已发布文档数
	const groups = await prisma.$queryRaw<GroupTreeRow[]>`
		SELECT
			g.id, g.parent_id, g.scope_type, g.scope_ref_id,
			g.name, g.description, g.owner_user_id,
			u.name AS owner_name,
			g.approval_enabled, g.file_size_limit_mb, g.status,
			COALESCE(dc.cnt, 0) AS file_count
		FROM doc_groups g
		LEFT JOIN doc_users u ON u.id = g.owner_user_id
		LEFT JOIN (
			SELECT group_id, COUNT(*) AS cnt
			FROM doc_documents
			WHERE status = 4 AND deleted_at IS NULL
			GROUP BY group_id
		) dc ON dc.group_id = g.id
		WHERE g.deleted_at IS NULL AND g.status = 1
		ORDER BY g.created_at ASC
	`

	// 2) 查询部门列表
	const departments = await prisma.$queryRaw<DepartmentRow[]>`
		SELECT d.id, d.name, d.owner_user_id, u.name AS owner_name, d.feishu_revoked
		FROM doc_departments d
		LEFT JOIN doc_users u ON u.id = d.owner_user_id
		WHERE d.deleted_at IS NULL AND d.status = 1
		ORDER BY d.created_at ASC
	`

	// 3) 查询产品线列表
	const productLines = await prisma.$queryRaw<ProductLineRow[]>`
		SELECT
			pl.id, pl.name, pl.description, pl.owner_user_id,
			u.name AS owner_name, pl.status, pl.created_at,
			0 AS group_count
		FROM doc_product_lines pl
		LEFT JOIN doc_users u ON u.id = pl.owner_user_id
		WHERE pl.deleted_at IS NULL AND pl.status = 1
		ORDER BY pl.created_at ASC
	`

	// 4) 查询所有已发布文档（用于树节点文件展示）
	const docs = await prisma.$queryRaw<DocFileRow[]>`
		SELECT id, title, ext, group_id
		FROM doc_documents
		WHERE status = 4 AND deleted_at IS NULL AND group_id IS NOT NULL
		ORDER BY title ASC
	`

	// 按 group_id 分组
	const docsByGroup = new Map<number, Array<{ id: number; name: string; type: string }>>()
	for (const d of docs) {
		const gid = Number(d.group_id)
		if (!docsByGroup.has(gid)) docsByGroup.set(gid, [])
		docsByGroup.get(gid)!.push({ id: Number(d.id), name: d.title, type: d.ext || '' })
	}

	// 5) 将平铺组列表构建为树（仅用户可访问的组展示 files）
	const flatGroups: TreeGroup[] = groups.map(g => {
		const gid = Number(g.id)
		const accessible = canAccessGroupFiles({
			id: gid,
			scopeType: g.scope_type,
			scopeRefId: g.scope_ref_id ? Number(g.scope_ref_id) : null,
			ownerUserId: g.owner_user_id ? Number(g.owner_user_id) : undefined,
		})
		return {
			id: gid,
			name: g.name,
			fileCount: Number(g.file_count),
			owner: g.owner_name || '',
			desc: g.description,
			scopeType: g.scope_type,
			scopeRefId: g.scope_ref_id ? Number(g.scope_ref_id) : null,
			parentId: g.parent_id ? Number(g.parent_id) : null,
			children: [],
			files: accessible ? (docsByGroup.get(gid) || []) : [],
		}
	})

	// 按 ID 索引，用于快速查找父节点
	const groupMap = new Map<number, TreeGroup>()
	for (const g of flatGroups) groupMap.set(g.id, g)

	// 构建父子关系，收集顶级组
	const rootGroups: TreeGroup[] = []
	for (const g of flatGroups) {
		if (g.parentId && groupMap.has(g.parentId)) {
			groupMap.get(g.parentId)!.children.push(g)
		} else {
			rootGroups.push(g)
		}
	}

	// 5) 按 scope 分类
	const companyGroups = rootGroups.filter(g => g.scopeType === 1)
	const deptGroupsMap = new Map<number, TreeGroup[]>()
	const plGroupsMap = new Map<number, TreeGroup[]>()

	for (const g of rootGroups) {
		if (g.scopeType === 2 && g.scopeRefId) {
			if (!deptGroupsMap.has(g.scopeRefId)) deptGroupsMap.set(g.scopeRefId, [])
			deptGroupsMap.get(g.scopeRefId)!.push(g)
		}
		if (g.scopeType === 3 && g.scopeRefId) {
			if (!plGroupsMap.has(g.scopeRefId)) plGroupsMap.set(g.scopeRefId, [])
			plGroupsMap.get(g.scopeRefId)!.push(g)
		}
	}

	// 6) 组装最终响应
	const tree = [
		{
			id: 'company',
			label: '公司层',
			scope: 'company',
			badge: companyGroups.length,
			groups: companyGroups,
		},
		{
			id: 'department',
			label: '按部门',
			scope: 'department',
			badge: departments.length,
			orgUnits: departments.map(d => {
				const dGroups = deptGroupsMap.get(Number(d.id)) || []
				return {
					id: `dept_${d.id}`,
					label: d.name,
					badge: dGroups.length,
					feishuRevoked: d.feishu_revoked === 1,
					groups: dGroups,
				}
			}),
		},
		{
			id: 'productline',
			label: '按产品线',
			scope: 'productline',
			badge: productLines.length,
			orgUnits: productLines.map(pl => {
				const pGroups = plGroupsMap.get(Number(pl.id)) || []
				return {
					id: `pl_${pl.id}`,
					label: pl.name,
					badge: pGroups.length,
					groups: pGroups,
				}
			}),
		},
	]

	return ok(tree)
})
