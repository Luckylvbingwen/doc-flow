/**
 * PUT /api/admin/users/:id/roles
 * 系统管理页面 — 整包指派公司层管理员 / 产品线负责人（§6.9.2 管理弹窗）
 *
 * Body: { companyAdmin: boolean, plHead: boolean }
 *
 * 约束：
 *   - 目标用户不能是 super_admin（受保护）
 *   - 不处理 dept_head（飞书同步只读）
 *   - 取消 plHead 时若仍是任何产品线的 owner_user_id，返回 409
 *
 * 鉴权：admin:role_assign（仅 super_admin）
 */
import { prisma } from '~/server/utils/prisma'
import { adminRoleAssignBodySchema } from '~/server/schemas/admin'
import { SYSTEM_ROLE_CODES } from '~/server/constants/system-roles'
import { writeLog } from '~/server/utils/operation-log'
import { LOG_ACTIONS } from '~/server/constants/log-actions'
import {
	grantRole, revokeRole, hasRole, countProductLinesOwnedBy,
} from '~/server/utils/system-role'
import {
	USER_NOT_FOUND,
	ADMIN_SUPER_ADMIN_PROTECTED,
	ADMIN_PL_HEAD_HAS_OWNERSHIP,
} from '~/server/constants/error-codes'

export default defineEventHandler(async (event) => {
	const denied = await requirePermission(event, 'admin:role_assign')
	if (denied) return denied

	const userIdParam = getRouterParam(event, 'id')
	const userId = Number(userIdParam)
	if (!Number.isFinite(userId) || userId <= 0) {
		return fail(event, 400, USER_NOT_FOUND, '用户 ID 无效')
	}

	const body = await readValidatedBody(event, adminRoleAssignBodySchema.parse)

	// ── 用户存在性校验 ──
	const targetUser = await prisma.doc_users.findFirst({
		where: { id: BigInt(userId), deleted_at: null },
		select: { id: true, name: true, status: true },
	})
	if (!targetUser) {
		return fail(event, 404, USER_NOT_FOUND, '用户不存在')
	}

	// ── 系统管理员受保护 ──
	const isSuperAdmin = await hasRole(userId, SYSTEM_ROLE_CODES.SUPER_ADMIN)
	if (isSuperAdmin) {
		return fail(event, 403, ADMIN_SUPER_ADMIN_PROTECTED, '系统管理员为系统预设，不可通过此接口变更')
	}

	// ── 取消 pl_head 的归属守卫 ──
	const currentlyPlHead = await hasRole(userId, SYSTEM_ROLE_CODES.PL_HEAD)
	if (currentlyPlHead && !body.plHead) {
		const ownedCount = await countProductLinesOwnedBy(userId)
		if (ownedCount > 0) {
			return fail(
				event, 409, ADMIN_PL_HEAD_HAS_OWNERSHIP,
				`该用户仍负责 ${ownedCount} 个产品线，请先在产品线管理中移除其负责关系后再取消该角色`,
			)
		}
	}

	const operatorId = Number(event.context.user?.id ?? 0)
	const operatorName = event.context.user?.name ?? '系统管理员'

	// ── 事务：按 payload 增/删 company_admin / pl_head ──
	const changes: string[] = []

	await prisma.$transaction(async (tx) => {
		// company_admin（全局 scope）
		const currentlyCompanyAdmin = await hasRole(userId, SYSTEM_ROLE_CODES.COMPANY_ADMIN, tx)
		if (body.companyAdmin && !currentlyCompanyAdmin) {
			await grantRole(userId, SYSTEM_ROLE_CODES.COMPANY_ADMIN, {
				scopeType: null, scopeRefId: null, createdBy: operatorId, tx,
			})
			changes.push('授予公司层管理员')
		} else if (!body.companyAdmin && currentlyCompanyAdmin) {
			await revokeRole(userId, SYSTEM_ROLE_CODES.COMPANY_ADMIN, {
				scopeType: null, scopeRefId: null, tx,
			})
			changes.push('撤销公司层管理员')
		}

		// pl_head（可能存在多条 scope=产品线 的记录；业务上"角色身份"= 至少一条）
		if (body.plHead && !currentlyPlHead) {
			// 仅赋予"无 scope"的候选身份，具体产品线归属由"创建/编辑产品线"入口建立
			await grantRole(userId, SYSTEM_ROLE_CODES.PL_HEAD, {
				scopeType: null, scopeRefId: null, createdBy: operatorId, tx,
			})
			changes.push('授予产品线负责人')
		} else if (!body.plHead && currentlyPlHead) {
			// 上面已校验无产品线归属，这里清空所有 scope 下的 pl_head 记录
			await revokeRole(userId, SYSTEM_ROLE_CODES.PL_HEAD, { tx })
			changes.push('撤销产品线负责人')
		}
	})

	// ── 埋点 ──
	if (changes.length > 0) {
		const desc = `${operatorName} 更新了「${targetUser.name}」的系统角色：${changes.join('、')}`
		await writeLog({
			actorUserId: operatorId,
			action: LOG_ACTIONS.ADMIN_ROLE_ASSIGN,
			targetType: 'user',
			targetId: userId,
			detail: {
				desc,
				targetUserName: targetUser.name,
				companyAdmin: body.companyAdmin,
				plHead: body.plHead,
			},
		})
	}

	return ok({ changed: changes.length > 0, changes }, changes.length > 0 ? '角色已更新' : '无变更')
})
