/**
 * PUT /api/rbac/roles/:id
 * 更新角色基本信息
 */
import { prisma } from '../../../utils/prisma'

interface RoleCheckRow {
	is_system: number
	code: string
}

export default defineEventHandler(async (event) => {
	const denied = await requirePermission(event, 'role:update')
	if (denied) return denied

	const id = Number(getRouterParam(event, 'id'))
	if (!id || isNaN(id)) {
		return fail(event, 400, 'INVALID_PARAMS', '无效的角色 ID')
	}

	const body = await readBody<{
		name?: string
		description?: string
		status?: number
	}>(event)

	const name = body.name?.trim() || ''
	if (!name) {
		return fail(event, 400, 'INVALID_PARAMS', '角色名称不能为空')
	}

	// 检查角色存在
	const rows = await prisma.$queryRaw<RoleCheckRow[]>`
		SELECT is_system, code FROM sys_roles
		WHERE id = ${id} AND deleted_at IS NULL
		LIMIT 1
	`

	if (!rows.length) {
		return fail(event, 404, 'ROLE_NOT_FOUND', '角色不存在')
	}

	// 系统内置角色不允许修改 code 和 is_system，但允许改名和描述
	const description = body.description?.trim() || null
	const status = body.status === 0 ? 0 : 1

	// 系统内置角色不允许停用
	if (rows[0].is_system === 1 && status === 0) {
		return fail(event, 400, 'SYSTEM_ROLE_PROTECTED', '系统内置角色不可停用')
	}

	await prisma.$executeRaw`
		UPDATE sys_roles
		SET name = ${name}, description = ${description}, status = ${status}
		WHERE id = ${id}
	`

	return ok(null, '角色更新成功')
})
