/**
 * GET /api/rbac/users
 * 获取可分配角色的用户列表（简化版，用于下拉选择）
 */
import { prisma } from '../../utils/prisma'

interface UserRow {
	id: bigint | number
	name: string
	email: string | null
}

export default defineEventHandler(async (event) => {
	const denied = await requirePermission(event, 'role:assign')
	if (denied) return denied

	const query = getQuery(event)
	const keyword = (query.keyword as string || '').trim()

	let rows: UserRow[]
	if (keyword) {
		const like = `%${keyword}%`
		rows = await prisma.$queryRaw<UserRow[]>`
			SELECT id, name, email FROM doc_users
			WHERE deleted_at IS NULL AND status = 1
			  AND (name LIKE ${like} OR email LIKE ${like})
			ORDER BY id
			LIMIT 50
		`
	} else {
		rows = await prisma.$queryRaw<UserRow[]>`
			SELECT id, name, email FROM doc_users
			WHERE deleted_at IS NULL AND status = 1
			ORDER BY id
			LIMIT 50
		`
	}

	return ok(rows.map(r => ({
		id: Number(r.id),
		name: r.name,
		email: r.email
	})))
})
