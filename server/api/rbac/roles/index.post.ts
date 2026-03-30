/**
 * POST /api/rbac/roles
 * 创建新角色
 */
import { prisma } from '~/server/utils/prisma'
import { roleCreateSchema } from '~/server/schemas/rbac'
import type { ExistRow } from '~/server/types/rbac'

export default defineEventHandler(async (event) => {
	const denied = await requirePermission(event, 'role:create')
	if (denied) return denied

	const body = await readValidatedBody(event, roleCreateSchema.parse)

	const code = body.code.trim()
	const name = body.name.trim()
	const description = body.description?.trim() || ''
	const status = body.status ?? 1

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
