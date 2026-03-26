/**
 * POST /api/rbac/roles
 * 创建新角色
 */
import { prisma } from '../../../utils/prisma'

interface ExistRow {
	cnt: bigint | number
}

export default defineEventHandler(async (event) => {
	const denied = await requirePermission(event, 'role:create')
	if (denied) return denied

	const body = await readBody<{
		code?: string
		name?: string
		description?: string
		status?: number
	}>(event)

	const code = body.code?.trim() || ''
	const name = body.name?.trim() || ''
	const description = body.description?.trim() || ''
	const status = body.status === 0 ? 0 : 1

	if (!code || !name) {
		return fail(event, 400, 'INVALID_PARAMS', '角色标识和名称不能为空')
	}

	if (!/^[a-z][a-z0-9_]{1,48}$/.test(code)) {
		return fail(event, 400, 'INVALID_CODE', '角色标识仅允许小写字母、数字、下划线，2-49位')
	}

	// 检查 code 唯一
	const existing = await prisma.$queryRaw<ExistRow[]>`
		SELECT COUNT(*) as cnt FROM sys_roles
		WHERE code = ${code} AND deleted_at IS NULL
	`
	if (Number(existing[0]?.cnt) > 0) {
		return fail(event, 409, 'ROLE_CODE_EXISTS', '角色标识已存在')
	}

	const userId = event.context.user?.id ?? null

	await prisma.$executeRaw`
		INSERT INTO sys_roles (code, name, description, is_system, status, created_by)
		VALUES (${code}, ${name}, ${description || null}, 0, ${status}, ${userId})
	`

	return ok(null, '角色创建成功')
})
