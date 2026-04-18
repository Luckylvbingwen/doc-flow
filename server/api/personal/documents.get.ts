/**
 * GET /api/personal/documents
 * 个人中心聚合列表（PRD §6.5）
 *
 * Query 见 server/schemas/personal.ts
 *   - tab: all/mine/shared/favorite/handover
 *   - status: 1草稿 2编辑中 3审批中 4已发布（handover tab 忽略）
 *   - keyword: 文件名模糊
 *   - page/pageSize: 分页
 *
 * 鉴权：登录即可（PRD §6.5.1 "不受组权限约束"）。
 *
 * 返回：
 *   - 非 handover tab: PaginatedData<PersonalDocItem>，每项带 source + permissionLevel(shared 时)
 *   - handover tab:   PaginatedData<HandoverGroup>，每组 = { user 基本信息 + docs[] }
 *
 * 注：handover tab 必须是部门负责人（doc_departments.owner_user_id / sys_user_roles.dept_head /
 *     doc_department_admins 三者之一），否则 403 HANDOVER_NOT_DEPT_HEAD。
 *
 * 性能注意：'all' tab 将三路数据合并到内存去重后分页，适用于 seed 级数据量；
 *          生产量大时应改为单条 SQL 的 UNION + ROW_NUMBER() 去重方案。
 */
import { Prisma } from '@prisma/client'
import { prisma } from '~/server/utils/prisma'
import { personalListQuerySchema } from '~/server/schemas/personal'
import { ITEM_SOURCE } from '~/server/constants/personal'
import { AUTH_REQUIRED, HANDOVER_NOT_DEPT_HEAD } from '~/server/constants/error-codes'

interface BaseRow {
	id: bigint
	title: string
	ext: string | null
	status: number
	group_id: bigint | null
	group_name: string | null
	owner_user_id: bigint
	owner_name: string | null
	current_version_id: bigint | null
	version_no: string | null
	file_size: bigint | null
	updated_at: Date
	source: string
	permission_level: number | null
}

interface PersonalDocItemDto {
	id: number
	title: string
	ext: string
	status: number
	groupId: number | null
	groupName: string
	ownerUserId: number
	ownerName: string
	versionNo: string
	fileSize: number
	updatedAt: number
	source: string
	permissionLevel: number | null
}

/** 通用 SELECT 列集合（各 source 共用） */
const SELECT_COLS = Prisma.sql`
	d.id,
	d.title,
	d.ext,
	d.status,
	d.group_id,
	g.name              AS group_name,
	d.owner_user_id,
	u.name              AS owner_name,
	d.current_version_id,
	v.version_no        AS version_no,
	v.file_size         AS file_size,
	d.updated_at
`

function mapRow(r: BaseRow): PersonalDocItemDto {
	return {
		id: Number(r.id),
		title: r.title,
		ext: r.ext ?? '',
		status: Number(r.status),
		groupId: r.group_id != null ? Number(r.group_id) : null,
		groupName: r.group_name ?? '-',
		ownerUserId: Number(r.owner_user_id),
		ownerName: r.owner_name ?? '未知用户',
		versionNo: r.version_no ?? '-',
		fileSize: r.file_size != null ? Number(r.file_size) : 0,
		updatedAt: new Date(r.updated_at).getTime(),
		source: r.source,
		permissionLevel: r.permission_level != null ? Number(r.permission_level) : null,
	}
}

/** 构造公共 filter（status + keyword）。docs 别名固定为 d。 */
function buildDocFilter(status: number | undefined, keyword: string | undefined): Prisma.Sql {
	const parts: Prisma.Sql[] = [
		Prisma.sql`d.deleted_at IS NULL`,
		Prisma.sql`d.deleted_at_real IS NULL`,
	]
	if (status != null) parts.push(Prisma.sql`d.status = ${status}`)
	if (keyword) parts.push(Prisma.sql`d.title LIKE ${`%${keyword}%`}`)
	return Prisma.sql`${Prisma.join(parts, ' AND ')}`
}

/** 我创建的 */
async function queryMine(userId: number, filter: Prisma.Sql): Promise<BaseRow[]> {
	return prisma.$queryRaw<BaseRow[]>`
		SELECT ${SELECT_COLS}, '${Prisma.raw(ITEM_SOURCE.MINE)}' AS source, NULL AS permission_level
		FROM doc_documents d
		LEFT JOIN doc_groups           g ON g.id = d.group_id
		LEFT JOIN doc_users            u ON u.id = d.owner_user_id
		LEFT JOIN doc_document_versions v ON v.id = d.current_version_id
		WHERE d.owner_user_id = ${userId} AND ${filter}
		ORDER BY d.updated_at DESC, d.id DESC
	`
}

/** 分享给我的（不含我自己是 owner 的） */
async function queryShared(userId: number, filter: Prisma.Sql): Promise<BaseRow[]> {
	return prisma.$queryRaw<BaseRow[]>`
		SELECT ${SELECT_COLS}, '${Prisma.raw(ITEM_SOURCE.SHARED)}' AS source, p.permission AS permission_level
		FROM doc_document_permissions p
		JOIN doc_documents             d ON d.id = p.document_id
		LEFT JOIN doc_groups           g ON g.id = d.group_id
		LEFT JOIN doc_users            u ON u.id = d.owner_user_id
		LEFT JOIN doc_document_versions v ON v.id = d.current_version_id
		WHERE p.user_id = ${userId}
		  AND p.deleted_at IS NULL
		  AND d.owner_user_id <> ${userId}
		  AND ${filter}
		ORDER BY d.updated_at DESC, d.id DESC
	`
}

/** 个人收藏（共享文档） */
async function queryFavorite(userId: number, filter: Prisma.Sql): Promise<BaseRow[]> {
	return prisma.$queryRaw<BaseRow[]>`
		SELECT ${SELECT_COLS}, '${Prisma.raw(ITEM_SOURCE.FAVORITE)}' AS source, NULL AS permission_level
		FROM doc_document_favorites   f
		JOIN doc_documents             d ON d.id = f.document_id
		LEFT JOIN doc_groups           g ON g.id = d.group_id
		LEFT JOIN doc_users            u ON u.id = d.owner_user_id
		LEFT JOIN doc_document_versions v ON v.id = d.current_version_id
		WHERE f.user_id = ${userId} AND ${filter}
		ORDER BY d.updated_at DESC, d.id DESC
	`
}

// ── handover tab ──

interface HandoverDeptRow {
	id: bigint
	feishu_department_id: string | null
	name: string
}

/** 查询当前用户管辖的部门 */
async function getManagedDepartments(userId: number): Promise<HandoverDeptRow[]> {
	return prisma.$queryRaw<HandoverDeptRow[]>`
		SELECT DISTINCT d.id, d.feishu_department_id, d.name
		FROM doc_departments d
		WHERE d.deleted_at IS NULL AND d.status = 1 AND (
			d.owner_user_id = ${userId}
			OR EXISTS (
				SELECT 1 FROM sys_user_roles ur
				JOIN sys_roles r ON r.id = ur.role_id
				WHERE ur.user_id = ${userId} AND r.code = 'dept_head'
				  AND ur.scope_type = 1 AND ur.scope_ref_id = d.id
				  AND r.status = 1 AND r.deleted_at IS NULL
			)
			OR EXISTS (
				SELECT 1 FROM doc_department_admins da
				WHERE da.user_id = ${userId} AND da.department_id = d.id
			)
		)
	`
}

async function handleHandover(
	userId: number,
	opts: { keyword?: string; page: number; pageSize: number },
) {
	const depts = await getManagedDepartments(userId)
	if (depts.length === 0) {
		return { __forbidden: true } as const
	}

	const feishuIds = depts.map(d => d.feishu_department_id).filter((x): x is string => !!x)
	if (feishuIds.length === 0) {
		return { list: [] as unknown[], total: 0, page: opts.page, pageSize: opts.pageSize }
	}

	// 离职员工（status=0）且其飞书部门列表跟管辖部门有交集
	// 用相关子查询匹配 feishu_department_ids JSON 数组
	const deptIdsByFeishu = new Map(depts.map(d => [d.feishu_department_id!, { id: Number(d.id), name: d.name }]))
	const users = await prisma.$queryRaw<Array<{
		id: bigint
		name: string
		avatar_url: string | null
		feishu_department_ids: unknown
		updated_at: Date
	}>>`
		SELECT u.id, u.name, u.avatar_url, fu.feishu_department_ids, u.updated_at
		FROM doc_users u
		JOIN doc_feishu_users fu ON fu.feishu_open_id = u.feishu_open_id
		WHERE u.status = 0
		  AND u.deleted_at IS NULL
		  AND EXISTS (
			SELECT 1 FROM JSON_TABLE(fu.feishu_department_ids, '$[*]' COLUMNS(did VARCHAR(64) PATH '$')) jt
			WHERE jt.did IN (${Prisma.join(feishuIds)})
		  )
		ORDER BY u.updated_at DESC, u.id DESC
	`

	// 为每个离职用户归属到其所属的**管辖**部门（取 intersection 的第一个）
	const userToDept = new Map<number, { id: number; name: string }>()
	for (const u of users) {
		const ids = Array.isArray(u.feishu_department_ids) ? (u.feishu_department_ids as string[]) : []
		for (const did of ids) {
			const dept = deptIdsByFeishu.get(did)
			if (dept) { userToDept.set(Number(u.id), dept); break }
		}
	}

	const userIds = users.map(u => Number(u.id))
	if (userIds.length === 0) {
		return { list: [] as unknown[], total: 0, page: opts.page, pageSize: opts.pageSize }
	}

	// 查这些离职用户名下的文档
	const docFilter = buildDocFilter(undefined, opts.keyword)
	const docs = await prisma.$queryRaw<BaseRow[]>`
		SELECT ${SELECT_COLS}, '${Prisma.raw(ITEM_SOURCE.MINE)}' AS source, NULL AS permission_level
		FROM doc_documents d
		LEFT JOIN doc_groups           g ON g.id = d.group_id
		LEFT JOIN doc_users            u ON u.id = d.owner_user_id
		LEFT JOIN doc_document_versions v ON v.id = d.current_version_id
		WHERE d.owner_user_id IN (${Prisma.join(userIds)}) AND ${docFilter}
		ORDER BY d.updated_at DESC, d.id DESC
	`

	const docsByUser = new Map<number, PersonalDocItemDto[]>()
	for (const doc of docs) {
		const k = Number(doc.owner_user_id)
		const arr = docsByUser.get(k) ?? []
		arr.push(mapRow(doc))
		docsByUser.set(k, arr)
	}

	// 组装 group（仅包含有文档的离职人员）
	const groups = users
		.filter(u => (docsByUser.get(Number(u.id))?.length ?? 0) > 0)
		.map(u => {
			const dept = userToDept.get(Number(u.id)) ?? { id: 0, name: '-' }
			return {
				userId: Number(u.id),
				userName: u.name,
				avatarUrl: u.avatar_url ?? '',
				departmentId: dept.id,
				departmentName: dept.name,
				leftAt: new Date(u.updated_at).getTime(), // 离职时间近似用 updated_at
				documents: docsByUser.get(Number(u.id)) ?? [],
			}
		})

	const total = groups.length
	const offset = (opts.page - 1) * opts.pageSize
	const list = groups.slice(offset, offset + opts.pageSize)

	return { list, total, page: opts.page, pageSize: opts.pageSize }
}

export default defineEventHandler(async (event) => {
	const user = event.context.user
	if (!user) return fail(event, 401, AUTH_REQUIRED, '请先登录')

	const query = await getValidatedQuery(event, personalListQuerySchema.parse)
	const { tab, status, keyword, page, pageSize } = query

	// ── handover：特殊路径 ──
	if (tab === 'handover') {
		const res = await handleHandover(user.id, { keyword, page, pageSize })
		if ('__forbidden' in res) return fail(event, 403, HANDOVER_NOT_DEPT_HEAD, '仅部门负责人可查看离职交接')
		return ok(res)
	}

	// ── 普通 tab ──
	const filter = buildDocFilter(status, keyword)
	let rows: BaseRow[] = []

	if (tab === 'mine') {
		rows = await queryMine(user.id, filter)
	} else if (tab === 'shared') {
		rows = await queryShared(user.id, filter)
	} else if (tab === 'favorite') {
		rows = await queryFavorite(user.id, filter)
	} else {
		// all：三路合并 + 按 id 去重（保留优先级：mine > shared > favorite）
		const [mine, shared, favorite] = await Promise.all([
			queryMine(user.id, filter),
			queryShared(user.id, filter),
			queryFavorite(user.id, filter),
		])
		const seen = new Set<string>()
		for (const r of [...mine, ...shared, ...favorite]) {
			const key = String(r.id)
			if (seen.has(key)) continue
			seen.add(key)
			rows.push(r)
		}
		// 按 updated_at 倒序
		rows.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
	}

	const total = rows.length
	const offset = (page - 1) * pageSize
	const list = rows.slice(offset, offset + pageSize).map(mapRow)

	return ok({ list, total, page, pageSize })
})
