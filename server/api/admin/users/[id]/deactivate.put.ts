/**
 * PUT /api/admin/users/:id/deactivate
 * 停用用户 — status=0，清理组成员资格，交接负责组，移除审批链节点
 * 触发通知：M22（负责组变更）、M23（离职交接 → 部门负责人）、M24（审批链变更 → 组负责人）
 * 鉴权：admin:role_assign（仅 super_admin）
 */
import { deactivateUser } from '~/server/utils/user-deactivation'
import { deactivateUserBodySchema } from '~/server/schemas/admin'
import {
	INVALID_PARAMS,
	USER_NOT_FOUND,
	ADMIN_SUPER_ADMIN_PROTECTED,
	ADMIN_USER_ALREADY_DEACTIVATED,
	ADMIN_SELF_DEACTIVATE,
} from '~/server/constants/error-codes'

export default defineEventHandler(async (event) => {
	const denied = await requirePermission(event, 'admin:role_assign')
	if (denied) return denied

	const userIdParam = getRouterParam(event, 'id')
	const userId = Number(userIdParam)
	if (!Number.isFinite(userId) || userId <= 0) {
		return fail(event, 400, INVALID_PARAMS, '用户 ID 无效')
	}

	const operatorId = Number(event.context.user?.id ?? 0)
	const operatorName = event.context.user?.name ?? '管理员'
	if (userId === operatorId) {
		return fail(event, 400, ADMIN_SELF_DEACTIVATE, '不能停用自己的账号')
	}

	const body = await readValidatedBody(event, deactivateUserBodySchema.parse)

	const result = await deactivateUser({
		userId,
		successorId: body.successorId,
		operatorId,
		operatorName,
		source: 'admin',
	})

	if (!result.success) {
		const codeMap: Record<string, { status: number, code: string }> = {
			not_found: { status: 404, code: USER_NOT_FOUND },
			already_deactivated: { status: 409, code: ADMIN_USER_ALREADY_DEACTIVATED },
			super_admin: { status: 403, code: ADMIN_SUPER_ADMIN_PROTECTED },
			successor_invalid: { status: 400, code: USER_NOT_FOUND },
		}
		const mapped = codeMap[result.skipReason ?? ''] ?? { status: 400, code: INVALID_PARAMS }
		return fail(event, mapped.status, mapped.code, result.message)
	}

	return ok(null, result.message)
})
