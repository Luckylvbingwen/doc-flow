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
	return feishuPost(
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

/** 遍历所有部门拉取全部用户（去重） */
async function fetchAllUsers(departments: FeishuDept[]): Promise<Map<string, FeishuContactUser>> {
	const userMap = new Map<string, FeishuContactUser>()

	const rootUsers = await fetchUsersByDepartment('0')
	for (const u of rootUsers) {
		if (u.user_id && !userMap.has(u.user_id)) userMap.set(u.user_id, u)
	}

	for (const dept of departments) {
		const deptId = dept.open_department_id || ''
		if (!deptId) continue
		const users = await fetchUsersByDepartment(deptId)
		for (const u of users) {
			if (u.user_id && !userMap.has(u.user_id)) userMap.set(u.user_id, u)
		}
	}

	return userMap
}

export type { FeishuSyncResult } from '~/server/types/feishu'

/**
 * 执行飞书通讯录同步（供 API 接口和定时任务共用）
 * 流程：验证 token → 拉取部门树 → 遍历拉取用户 → upsert → 标记已离职
 */
export async function feishuSyncContacts(): Promise<FeishuSyncResult> {
	const { prisma } = await import('./prisma')

	// 1. 验证 token
	await getFeishuTenantToken()

	// 2. 拉取部门树
	const departments = await fetchAllDepartments('0')

	// 3. 拉取全部用户
	const userMap = await fetchAllUsers(departments)

	if (userMap.size === 0) {
		return { total: 0, departments: departments.length, created: 0, updated: 0, hidden: 0 }
	}

	// 4. upsert 到 doc_feishu_users
	let created = 0
	let updated = 0
	const syncedUserIds = new Set<string>()

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
		const localStatus = (isActive && !isResigned && !isFrozen) ? 'normal' : 'hidden'
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
				username, name, email, mobile,
				avatar, localStatus, openId,
				unionId, deptIds, feishuUserId,
			)
			updated++
		} else {
			await prisma.$executeRawUnsafe(
				`INSERT INTO doc_feishu_users
					(username, nickname, email, mobile, avatar, status,
					 feishu_open_id, feishu_union_id, feishu_user_id, feishu_department_ids)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				username, name, email, mobile, avatar, localStatus,
				openId, unionId, feishuUserId, deptIds,
			)
			created++
		}
	}

	// 5. 将飞书侧已不存在的用户标记为 hidden
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

	return { total: userMap.size, departments: departments.length, created, updated, hidden }
}
