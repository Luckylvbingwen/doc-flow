/**
 * 飞书开放平台 API 工具
 *
 * 参考 task-platform/app/common/library/Feishu.php 翻译为 TypeScript 版本。
 * 功能：tenant_access_token 缓存管理、消息发送（文本 / 交互卡片）。
 *
 * 飞书开放平台文档：https://open.feishu.cn/document/server-docs
 */
import type {
	FeishuApiResponse,
	FeishuOAuthTokenResponse,
	FeishuUserInfoResponse,
	FeishuDept,
	FeishuContactUser,
	FeishuSyncResult,
} from '~/server/types/feishu'

const FEISHU_BASE_URL = 'https://open.feishu.cn/open-apis'

/** token 缓存（进程内存级，简单够用；多实例部署可换 Redis） */
let tokenCache: { token: string; expiresAt: number } | null = null

// ================================================================
//  Token
// ================================================================

/**
 * 获取 tenant_access_token（自建应用模式）
 * 有效期 2h，提前 5 分钟过期刷新
 */
export async function getFeishuTenantToken(): Promise<string> {
	if (tokenCache && Date.now() < tokenCache.expiresAt) {
		return tokenCache.token
	}

	const config = useRuntimeConfig()
	const appId = String(config.feishuAppId || '')
	const appSecret = String(config.feishuAppSecret || '')

	if (!appId || !appSecret) {
		throw new Error('飞书 App ID / App Secret 未配置')
	}

	const res = await $fetch<{
		code: number
		msg: string
		tenant_access_token: string
		expire: number
	}>(`${FEISHU_BASE_URL}/auth/v3/tenant_access_token/internal`, {
		method: 'POST',
		body: { app_id: appId, app_secret: appSecret },
	})

	if (res.code !== 0) {
		throw new Error(`获取 tenant_access_token 失败: ${res.msg}`)
	}

	const expireMs = (res.expire - 300) * 1000 // 提前 5 分钟过期
	tokenCache = {
		token: res.tenant_access_token,
		expiresAt: Date.now() + Math.max(expireMs, 60_000),
	}

	return tokenCache.token
}

// ================================================================
//  通用请求
// ================================================================

/** 带鉴权的 GET 请求 */
export async function feishuGet<T = Record<string, unknown>>(
	path: string,
	query?: Record<string, string>,
): Promise<T> {
	const token = await getFeishuTenantToken()

	try {
		const res = await $fetch<FeishuApiResponse>(
			`${FEISHU_BASE_URL}${path}`,
			{
				method: 'GET',
				headers: { Authorization: `Bearer ${token}` },
				query,
			},
		)

		if (res.code !== 0) {
			throw new Error(`飞书 API [${path}]: code=${res.code} ${res.msg}`)
		}

		return (res.data ?? {}) as T
	} catch (err: unknown) {
		const fetchErr = err as { data?: { code?: number; msg?: string }; statusCode?: number }
		if (fetchErr?.data?.code !== undefined) {
			throw new Error(`飞书 API [${path}] HTTP ${fetchErr.statusCode}: code=${fetchErr.data.code} ${fetchErr.data.msg || ''}`)
		}
		throw err
	}
}

/** 带鉴权的 POST 请求 */
export async function feishuPost<T = Record<string, unknown>>(
	path: string,
	body?: Record<string, unknown>,
	query?: Record<string, string>,
): Promise<T> {
	const token = await getFeishuTenantToken()

	try {
		const res = await $fetch<FeishuApiResponse>(
			`${FEISHU_BASE_URL}${path}`,
			{
				method: 'POST',
				headers: { Authorization: `Bearer ${token}` },
				body,
				query,
			},
		)

		if (res.code !== 0) {
			throw new Error(`飞书 API [${path}]: code=${res.code} ${res.msg}`)
		}

		return (res.data ?? {}) as T
	} catch (err: unknown) {
		const fetchErr = err as { data?: { code?: number; msg?: string }; statusCode?: number }
		if (fetchErr?.data?.code !== undefined) {
			throw new Error(`飞书 API [${path}] HTTP ${fetchErr.statusCode}: code=${fetchErr.data.code} ${fetchErr.data.msg || ''}`)
		}
		throw err
	}
}

/** 带鉴权的 PATCH 请求 */
export async function feishuPatch<T = Record<string, unknown>>(
	path: string,
	body?: Record<string, unknown>,
	query?: Record<string, string>,
): Promise<T> {
	const token = await getFeishuTenantToken()

	try {
		const res = await $fetch<FeishuApiResponse>(
			`${FEISHU_BASE_URL}${path}`,
			{
				method: 'PATCH',
				headers: { Authorization: `Bearer ${token}` },
				body,
				query,
			},
		)

		if (res.code !== 0) {
			throw new Error(`飞书 API [${path}]: code=${res.code} ${res.msg}`)
		}

		return (res.data ?? {}) as T
	} catch (err: unknown) {
		const fetchErr = err as { data?: { code?: number; msg?: string }; statusCode?: number }
		if (fetchErr?.data?.code !== undefined) {
			throw new Error(`飞书 API [${path}] HTTP ${fetchErr.statusCode}: code=${fetchErr.data.code} ${fetchErr.data.msg || ''}`)
		}
		throw err
	}
}

// ================================================================
//  消息发送
// ================================================================

/**
 * 发送飞书机器人消息
 *
 * @param receiveId  接收者 ID（open_id / user_id / chat_id）
 * @param msgType    消息类型: text / interactive / post 等
 * @param content    消息内容 JSON 字符串
 * @param receiveIdType 接收者类型，默认 open_id
 */
export async function feishuSendMessage(
	receiveId: string,
	msgType: string,
	content: string,
	receiveIdType: 'open_id' | 'user_id' | 'union_id' | 'email' | 'chat_id' = 'open_id',
) {
	return feishuPost<{ message_id?: string; open_message_id?: string }>(
		'/im/v1/messages',
		{
			receive_id: receiveId,
			msg_type: msgType,
			content,
		},
		{ receive_id_type: receiveIdType },
	)
}

/** 发送纯文本消息 */
export async function feishuSendText(openId: string, text: string) {
	return feishuSendMessage(
		openId,
		'text',
		JSON.stringify({ text }),
	)
}

/** 发送交互卡片消息 */
export async function feishuSendCard(openId: string, card: Record<string, unknown>) {
	return feishuSendMessage(
		openId,
		'interactive',
		JSON.stringify(card),
	)
}

/** 更新已发送的交互卡片 */
export async function feishuUpdateCard(messageId: string, card: Record<string, unknown>) {
	return feishuPatch<{ message_id?: string }>(
		`/im/v1/messages/${messageId}`,
		{
			msg_type: 'interactive',
			content: JSON.stringify(card),
		},
	)
}

// ================================================================
//  OAuth — 授权码换 token + 获取用户信息
// ================================================================

/**
 * 飞书 OAuth 授权码换取用户信息
 * 流程：app_access_token → user_access_token → user_info
 */
export async function feishuCodeToUser(code: string) {
	const config = useRuntimeConfig()
	const appId = String(config.feishuAppId || '')
	const appSecret = String(config.feishuAppSecret || '')

	// 第一步：获取 app_access_token
	const appTokenRes = await $fetch<{
		code: number
		msg: string
		app_access_token: string
	}>(`${FEISHU_BASE_URL}/auth/v3/app_access_token/internal`, {
		method: 'POST',
		body: { app_id: appId, app_secret: appSecret },
	})

	if (appTokenRes.code !== 0 || !appTokenRes.app_access_token) {
		throw new Error(`获取飞书 app_access_token 失败: ${appTokenRes.msg}`)
	}

	// 第二步：用授权码换取 user_access_token
	const tokenRes = await $fetch<FeishuOAuthTokenResponse>(
		`${FEISHU_BASE_URL}/authen/v1/oidc/access_token`,
		{
			method: 'POST',
			headers: { Authorization: `Bearer ${appTokenRes.app_access_token}` },
			body: { grant_type: 'authorization_code', code },
		},
	)

	if (tokenRes.code !== 0 || !tokenRes.data?.access_token) {
		throw new Error(`飞书换取 access_token 失败: ${tokenRes.msg}`)
	}

	// 第三步：获取用户信息
	const userRes = await $fetch<FeishuUserInfoResponse>(
		`${FEISHU_BASE_URL}/authen/v1/user_info`,
		{
			method: 'GET',
			headers: { Authorization: `Bearer ${tokenRes.data.access_token}` },
		},
	)

	if (userRes.code !== 0) {
		throw new Error(`获取飞书用户信息失败: ${userRes.msg}`)
	}

	return {
		openId: userRes.data.open_id || '',
		unionId: userRes.data.union_id || '',
		userId: userRes.data.user_id || '',
		name: userRes.data.name || '',
		avatarUrl: userRes.data.avatar_url || '',
		email: userRes.data.email || '',
		mobile: userRes.data.mobile || '',
	}
}

// ================================================================
//  通讯录同步
// ================================================================

/** 递归拉取所有子部门 */
async function fetchAllDepartments(parentId = '0'): Promise<FeishuDept[]> {
	const all: FeishuDept[] = []

	async function recurse(pid: string) {
		let pageToken = ''
		do {
			const query: Record<string, string> = {
				department_id_type: 'open_department_id',
				page_size: '50',
			}
			if (pageToken) query.page_token = pageToken

			const data = await feishuGet<{
				items?: FeishuDept[]
				page_token?: string
				has_more?: boolean
			}>(`/contact/v3/departments/${pid}/children`, query)

			for (const dept of data.items || []) {
				all.push(dept)
				const deptId = dept.open_department_id || dept.department_id || ''
				if (deptId) await recurse(deptId)
			}

			pageToken = data.page_token || ''
		} while (pageToken)
	}

	await recurse(parentId)
	return all
}

/** 拉取某部门下的全部用户（自动翻页） */
async function fetchUsersByDepartment(departmentId: string): Promise<FeishuContactUser[]> {
	const users: FeishuContactUser[] = []
	let pageToken = ''

	do {
		const query: Record<string, string> = {
			department_id: departmentId,
			page_size: '50',
			department_id_type: 'open_department_id',
			user_id_type: 'user_id',
		}
		if (pageToken) query.page_token = pageToken

		const data = await feishuGet<{
			items?: FeishuContactUser[]
			page_token?: string
			has_more?: boolean
		}>('/contact/v3/users/find_by_department', query)

		for (const u of data.items || []) {
			users.push(u)
		}

		pageToken = data.page_token || ''
	} while (pageToken)

	return users
}

/**
 * 遍历所有部门拉取全部用户（去重 + 反推部门归属）
 *
 * 注意：飞书 `/contact/v3/users/find_by_department` 返回的 user 对象**可能不带**
 * `department_ids` 字段，因此这里不依赖该字段，而是从"我们按 dept_id 查询得到了
 * 这批用户"的调用路径反推每个用户的部门归属，最后用反向映射覆写 user.department_ids。
 * 这样做不受飞书响应字段变化影响，且天然支持一人多部门。
 */
async function fetchAllUsers(departments: FeishuDept[]): Promise<Map<string, FeishuContactUser>> {
	const userMap = new Map<string, FeishuContactUser>()
	const userDeptIds = new Map<string, Set<string>>()

	const recordDept = (userId: string, deptId: string) => {
		let set = userDeptIds.get(userId)
		if (!set) {
			set = new Set()
			userDeptIds.set(userId, set)
		}
		set.add(deptId)
	}

	// "0" 是虚拟根部门，返回的用户可能没有具体业务部门（比如公司级顶层角色），不记录部门归属
	const rootUsers = await fetchUsersByDepartment('0')
	for (const u of rootUsers) {
		if (u.user_id && !userMap.has(u.user_id)) userMap.set(u.user_id, u)
	}

	for (const dept of departments) {
		const deptId = dept.open_department_id || ''
		if (!deptId) continue
		const users = await fetchUsersByDepartment(deptId)
		for (const u of users) {
			if (!u.user_id) continue
			if (!userMap.has(u.user_id)) userMap.set(u.user_id, u)
			recordDept(u.user_id, deptId)
		}
	}

	// 用反向映射覆写 department_ids，避免下游 JSON.stringify(fu.department_ids || []) 拿空
	for (const [uid, deptSet] of userDeptIds) {
		const u = userMap.get(uid)
		if (u) u.department_ids = Array.from(deptSet)
	}

	return userMap
}

export type { FeishuSyncResult } from '~/server/types/feishu'

/**
 * 执行飞书通讯录同步（供 API 接口和定时任务共用）
 *
 * 对标 PRD §327：飞书同步员工账号策略 = 全部建 DocFlow 账号（含未加入任何组的人）
 *
 * 流程：
 *   1. 验证 token
 *   2. 拉取部门树 + 拉取全部用户
 *   3. upsert doc_feishu_users（通讯录镜像）
 *   4. upsert doc_departments（按 feishu_department_id 幂等）
 *   5. upsert doc_users（§327 全员预落地；id 用雪花，按 feishu_open_id 关联）
 *   6. 处理部门主管：写 doc_departments.owner_user_id + 指派 dept_head 角色
 *   7. 飞书侧已不存在的用户标记 hidden
 */
export async function feishuSyncContacts(): Promise<FeishuSyncResult> {
	const { prisma } = await import('./prisma')
	const { generateId } = await import('./snowflake')
	const { syncInheritedMembers } = await import('./permission-inheritance')

	const emptyResult: FeishuSyncResult = {
		total: 0, departments: 0,
		created: 0, updated: 0, hidden: 0,
		deptCreated: 0, deptUpdated: 0, deptRevoked: 0,
		docUserCreated: 0, docUserUpdated: 0,
		deptHeadAssigned: 0,
	}

	// 1. 验证 token
	await getFeishuTenantToken()

	// 2. 拉取部门树 + 用户
	const departments = await fetchAllDepartments('0')
	const userMap = await fetchAllUsers(departments)

	if (userMap.size === 0) {
		return { ...emptyResult, departments: departments.length }
	}

	// ──────────────────────────────────────────────────────────────
	// 3. upsert doc_feishu_users（通讯录镜像）
	// ──────────────────────────────────────────────────────────────
	let created = 0
	let updated = 0
	const syncedUserIds = new Set<string>()
	// 记录 open_id → 飞书 user_id 等关键映射，供后续步骤复用
	const userRecords: Array<{
		feishuUserId: string
		openId: string
		unionId: string
		name: string
		email: string | null
		mobile: string | null
		avatar: string | null
		localStatus: 'normal' | 'hidden'
	}> = []

	for (const [feishuUserId, fu] of userMap) {
		syncedUserIds.add(feishuUserId)

		const openId = fu.open_id || ''
		const unionId = fu.union_id || ''
		const name = fu.name || ''
		const enName = fu.en_name || ''
		const email = fu.email || ''
		const mobile = (fu.mobile || '').replace(/^\+86\s*/, '')
		const avatar = fu.avatar?.avatar_origin || fu.avatar?.avatar_240 || ''
		const deptIds = JSON.stringify(fu.department_ids || [])

		const fsStatus = fu.status || {}
		const isActive = fsStatus.is_activated !== false
		const isResigned = fsStatus.is_resigned === true
		const isFrozen = fsStatus.is_frozen === true
		const localStatus: 'normal' | 'hidden' = (isActive && !isResigned && !isFrozen) ? 'normal' : 'hidden'
		const username = enName || name

		const existing = await prisma.$queryRawUnsafe<{ id: number }[]>(
			'SELECT id FROM doc_feishu_users WHERE feishu_user_id = ? LIMIT 1',
			feishuUserId,
		)

		if (existing.length > 0) {
			await prisma.$executeRawUnsafe(
				`UPDATE doc_feishu_users SET
					username = ?, nickname = ?, email = ?, mobile = ?,
					avatar = ?, status = ?, feishu_open_id = ?,
					feishu_union_id = ?, feishu_department_ids = ?
				WHERE feishu_user_id = ?`,
				username, name, email || null, mobile || null,
				avatar || null, localStatus, openId,
				unionId, deptIds, feishuUserId,
			)
			updated++
		} else {
			await prisma.$executeRawUnsafe(
				`INSERT INTO doc_feishu_users
					(username, nickname, email, mobile, avatar, status,
					 feishu_open_id, feishu_union_id, feishu_user_id, feishu_department_ids)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				username, name, email || null, mobile || null, avatar || null, localStatus,
				openId, unionId, feishuUserId, deptIds,
			)
			created++
		}

		userRecords.push({
			feishuUserId, openId, unionId, name,
			email: email || null,
			mobile: mobile || null,
			avatar: avatar || null,
			localStatus,
		})
	}

	// ──────────────────────────────────────────────────────────────
	// 4. upsert doc_departments（按 feishu_department_id 幂等）
	// ──────────────────────────────────────────────────────────────
	let deptCreated = 0
	let deptUpdated = 0
	// open_department_id → doc_departments.id 映射，供后续步骤 6 复用
	const deptIdMap = new Map<string, bigint>()

	for (const dept of departments) {
		const openDeptId = dept.open_department_id || dept.department_id || ''
		const deptName = dept.name || ''
		if (!openDeptId || !deptName) continue

		const existing = await prisma.$queryRawUnsafe<{ id: bigint }[]>(
			'SELECT id FROM doc_departments WHERE feishu_department_id = ? LIMIT 1',
			openDeptId,
		)

		if (existing.length > 0) {
			await prisma.$executeRawUnsafe(
				`UPDATE doc_departments SET name = ?, updated_at = NOW(3)
				 WHERE id = ?`,
				deptName, existing[0].id,
			)
			deptIdMap.set(openDeptId, existing[0].id)
			deptUpdated++
		} else {
			const newId = generateId()
			await prisma.$executeRawUnsafe(
				`INSERT INTO doc_departments (id, feishu_department_id, name, status, created_by)
				 VALUES (?, ?, ?, 1, 0)`,
				newId, openDeptId, deptName,
			)
			deptIdMap.set(openDeptId, newId)
			deptCreated++
		}
	}

	// ──────────────────────────────────────────────────────────────
	// 4.5 检测飞书侧已撤销的部门 → 标记 feishu_revoked + 发 M25 通知
	// ──────────────────────────────────────────────────────────────
	let deptRevoked = 0
	const fetchedDeptIds = new Set<string>()
	for (const dept of departments) {
		const openDeptId = dept.open_department_id || dept.department_id || ''
		if (openDeptId) fetchedDeptIds.add(openDeptId)
	}

	// 查找本地有 feishu_department_id 但飞书侧已不存在、且尚未标记撤销的部门
	const allLocalDepts = await prisma.$queryRawUnsafe<{
		id: bigint
		feishu_department_id: string
		name: string
		owner_user_id: bigint | null
		feishu_revoked: number
	}[]>(
		`SELECT id, feishu_department_id, name, owner_user_id, feishu_revoked
		 FROM doc_departments
		 WHERE feishu_department_id IS NOT NULL AND deleted_at IS NULL`,
	)

	const { createNotifications } = await import('./notify')
	const { NOTIFICATION_TEMPLATES } = await import('~/server/constants/notification-templates')
	const revokeNotifications: Array<ReturnType<typeof NOTIFICATION_TEMPLATES.M25.build>> = []

	for (const localDept of allLocalDepts) {
		if (!fetchedDeptIds.has(localDept.feishu_department_id) && localDept.feishu_revoked === 0) {
			// 标记为飞书侧已撤销
			await prisma.$executeRawUnsafe(
				`UPDATE doc_departments SET feishu_revoked = 1, updated_at = NOW(3) WHERE id = ?`,
				localDept.id,
			)
			deptRevoked++

			// 通知部门负责人
			if (localDept.owner_user_id) {
				revokeNotifications.push(
					NOTIFICATION_TEMPLATES.M25.build({
						toUserId: localDept.owner_user_id,
						deptName: localDept.name,
						deptId: localDept.id,
					}),
				)
			}

			// 通知系统管理员
			const superAdmins = await prisma.$queryRawUnsafe<{ user_id: bigint }[]>(
				`SELECT ur.user_id FROM sys_user_roles ur
				 JOIN sys_roles r ON r.id = ur.role_id
				 WHERE r.code = 'super_admin'`,
			)
			for (const sa of superAdmins) {
				// 去重：如果部门负责人也是系统管理员，不重复通知
				if (localDept.owner_user_id && BigInt(sa.user_id) === BigInt(localDept.owner_user_id)) continue
				revokeNotifications.push(
					NOTIFICATION_TEMPLATES.M25.build({
						toUserId: sa.user_id,
						deptName: localDept.name,
						deptId: localDept.id,
					}),
				)
			}
		}
	}

	if (revokeNotifications.length > 0) {
		await createNotifications(revokeNotifications)
	}

	// ──────────────────────────────────────────────────────────────
	// 5. upsert doc_users（§327 全员预落地）
	// ──────────────────────────────────────────────────────────────
	let docUserCreated = 0
	let docUserUpdated = 0
	// open_id → doc_users.id 映射，供第 6 步主管识别复用
	const docUserIdMap = new Map<string, bigint>()

	for (const u of userRecords) {
		if (!u.openId) continue

		const status = u.localStatus === 'normal' ? 1 : 0

		const existing = await prisma.$queryRawUnsafe<{ id: bigint }[]>(
			'SELECT id FROM doc_users WHERE feishu_open_id = ? LIMIT 1',
			u.openId,
		)

		if (existing.length > 0) {
			await prisma.$executeRawUnsafe(
				`UPDATE doc_users SET
					name = ?, email = ?, mobile = ?, avatar_url = ?,
					feishu_union_id = ?, status = ?, updated_at = NOW(3)
				 WHERE id = ?`,
				u.name, u.email, u.mobile, u.avatar,
				u.unionId, status, existing[0].id,
			)
			docUserIdMap.set(u.openId, existing[0].id)
			docUserUpdated++
		} else {
			const newId = generateId()
			await prisma.$executeRawUnsafe(
				`INSERT INTO doc_users
					(id, feishu_open_id, feishu_union_id, name, email, mobile, avatar_url, status)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
				newId, u.openId, u.unionId, u.name, u.email, u.mobile, u.avatar, status,
			)
			docUserIdMap.set(u.openId, newId)
			docUserCreated++
		}
	}

	// ──────────────────────────────────────────────────────────────
	// 6. 部门主管 → 写 owner_user_id + 指派 dept_head 角色
	// ──────────────────────────────────────────────────────────────
	let deptHeadAssigned = 0
	const deptHeadRole = await prisma.$queryRawUnsafe<{ id: bigint }[]>(
		`SELECT id FROM sys_roles WHERE code = 'dept_head' LIMIT 1`,
	)
	const deptHeadRoleId = deptHeadRole[0]?.id

	if (deptHeadRoleId) {
		// feishu user_id → open_id 快查
		const feishuUserIdToOpenId = new Map<string, string>()
		for (const u of userRecords) {
			feishuUserIdToOpenId.set(u.feishuUserId, u.openId)
		}

		for (const dept of departments) {
			const openDeptId = dept.open_department_id || dept.department_id || ''
			const leaderUserId = dept.leader_user_id || ''
			if (!openDeptId || !leaderUserId) continue

			const deptDbId = deptIdMap.get(openDeptId)
			if (!deptDbId) continue

			const leaderOpenId = feishuUserIdToOpenId.get(leaderUserId)
			if (!leaderOpenId) continue

			const leaderDocUserId = docUserIdMap.get(leaderOpenId)
			if (!leaderDocUserId) continue

			// 6.1 查旧负责人并更新部门 owner
			const oldDept = await prisma.$queryRawUnsafe<{ owner_user_id: bigint | null }[]>(
				`SELECT owner_user_id FROM doc_departments WHERE id = ? LIMIT 1`,
				deptDbId,
			)
			const oldOwnerUserId = oldDept[0]?.owner_user_id ?? null

			await prisma.$executeRawUnsafe(
				`UPDATE doc_departments SET owner_user_id = ? WHERE id = ?`,
				leaderDocUserId, deptDbId,
			)

			// 6.1.1 负责人变更 → 同步继承成员（scope_type=2 部门）
			if (oldOwnerUserId == null || BigInt(oldOwnerUserId) !== BigInt(leaderDocUserId)) {
				await syncInheritedMembers(
					2,
					BigInt(deptDbId),
					oldOwnerUserId != null ? BigInt(oldOwnerUserId) : null,
					BigInt(leaderDocUserId),
					BigInt(leaderDocUserId),
				)
			}

			// 6.2 指派 dept_head 角色（scope_type=1 部门, scope_ref_id=部门id）
			//     唯一键 uk_user_role_scope (user_id, role_id, scope_type, scope_ref_id) 保证幂等
			await prisma.$executeRawUnsafe(
				`INSERT INTO sys_user_roles (user_id, role_id, scope_type, scope_ref_id, created_by)
				 VALUES (?, ?, 1, ?, 0)
				 ON DUPLICATE KEY UPDATE id = id`,
				leaderDocUserId, deptHeadRoleId, deptDbId,
			)

			deptHeadAssigned++
		}
	}

	// ──────────────────────────────────────────────────────────────
	// 7. 飞书侧已不存在的用户标记 hidden
	// ──────────────────────────────────────────────────────────────
	let hidden = 0
	if (syncedUserIds.size > 0) {
		const placeholders = Array.from(syncedUserIds).map(() => '?').join(',')
		const result = await prisma.$executeRawUnsafe(
			`UPDATE doc_feishu_users SET status = 'hidden'
			 WHERE status = 'normal' AND feishu_user_id NOT IN (${placeholders})`,
			...Array.from(syncedUserIds),
		)
		hidden = result
	}

	return {
		total: userMap.size,
		departments: departments.length,
		created, updated, hidden,
		deptCreated, deptUpdated, deptRevoked,
		docUserCreated, docUserUpdated,
		deptHeadAssigned,
	}
}
