/**
 * POST /api/integrations/feishu/sync-contacts
 * 同步飞书组织架构通讯录到 doc_feishu_users 表
 *
 * 参照 task-platform/app/common/command/FeishuSyncContactsCommand.php
 * 流程：拉取全部部门 → 遍历拉取用户 → upsert 到 doc_feishu_users
 *
 * 需要飞书权限：
 *   - 获取部门基础信息 (contact:department.base:readonly)
 *   - 获取用户基本信息 (contact:user.base:readonly)
 *   - 获取用户 user ID  (contact:user.employee_id:readonly)
 * 同时在「数据权限」→「通讯录权限范围」设为「全部成员」
 */
import { prisma } from '../../../utils/prisma'

interface FeishuDept {
	open_department_id: string
	department_id?: string
	name?: string
}

interface FeishuContactUser {
	user_id: string
	open_id: string
	union_id: string
	name: string
	en_name?: string
	email?: string
	mobile?: string
	avatar?: { avatar_origin?: string; avatar_240?: string }
	department_ids?: string[]
	status?: {
		is_activated?: boolean
		is_resigned?: boolean
		is_frozen?: boolean
	}
}

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

	// 根部门
	const rootUsers = await fetchUsersByDepartment('0')
	for (const u of rootUsers) {
		if (u.user_id && !userMap.has(u.user_id)) userMap.set(u.user_id, u)
	}

	// 遍历子部门
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

export default defineEventHandler(async (event) => {
	try {
		// 1. 验证 token
		await getFeishuTenantToken()

		// 2. 拉取部门树
		const departments = await fetchAllDepartments('0')

		// 3. 拉取全部用户
		const userMap = await fetchAllUsers(departments)

		if (userMap.size === 0) {
			return ok({ total: 0, created: 0, updated: 0, hidden: 0 }, '未获取到飞书用户')
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

			// 查是否已存在
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

		return ok({
			total: userMap.size,
			departments: departments.length,
			created,
			updated,
			hidden,
		}, '飞书通讯录同步完成')
	} catch (error) {
		console.error('feishu sync-contacts failed:', error)
		const msg = error instanceof Error ? error.message : '飞书通讯录同步失败'
		return fail(event, 500, 'FEISHU_SYNC_ERROR', msg)
	}
})
