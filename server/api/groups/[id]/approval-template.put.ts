/**
 * PUT /api/groups/:id/approval-template
 * 整包保存审批模板（开关 + 模式 + 有序审批人）
 * 事务内：create-or-update template → 删 nodes → 批量 insert nodes → 更新 approval_enabled
 */
import { prisma } from '~/server/utils/prisma'
import { isDuplicateKeyError } from '~/server/utils/db-errors'
import { generateId } from '~/server/utils/snowflake'
import { requireMemberPermission } from '~/server/utils/group-permission'
import { saveApprovalTemplateSchema } from '~/server/schemas/approval-template'
import {
	GROUP_NOT_FOUND,
	INVALID_PARAMS,
	APPROVAL_APPROVERS_REQUIRED,
	APPROVAL_INVALID_APPROVER,
} from '~/server/constants/error-codes'

export default defineEventHandler(async (event) => {
	const id = Number(getRouterParam(event, 'id'))
	if (!id || isNaN(id)) return fail(event, 400, INVALID_PARAMS, '无效的组ID')

	const body = await readValidatedBody(event, saveApprovalTemplateSchema.parse)
	const userId = event.context.user!.id

	const group = await prisma.doc_groups.findFirst({
		where: { id: BigInt(id), deleted_at: null },
		select: {
			id: true,
			scope_type: true,
			scope_ref_id: true,
			owner_user_id: true,
		},
	})
	if (!group) return fail(event, 404, GROUP_NOT_FOUND, '组不存在')

	const denied = await requireMemberPermission(event, {
		scopeType: group.scope_type,
		scopeRefId: group.scope_ref_id ? Number(group.scope_ref_id) : null,
		ownerUserId: Number(group.owner_user_id),
		groupId: id,
	})
	if (denied) return denied

	// 二次校验（schema refine 已校验，这里兜底防止绕过）
	if (body.approvalEnabled === 1 && body.approverUserIds.length === 0) {
		return fail(event, 400, APPROVAL_APPROVERS_REQUIRED, '开启审批时审批人不能为空')
	}

	// 校验所有审批人是活跃用户
	if (body.approverUserIds.length > 0) {
		const activeUsers = await prisma.doc_users.findMany({
			where: {
				id: { in: body.approverUserIds.map(u => BigInt(u)) },
				status: 1,
				deleted_at: null,
			},
			select: { id: true },
		})
		if (activeUsers.length !== body.approverUserIds.length) {
			return fail(event, 400, APPROVAL_INVALID_APPROVER, '存在已停用或不存在的审批人')
		}
	}

	// 查现有模板（用于事务内复用 template_id）
	const existing = await prisma.doc_approval_templates.findFirst({
		where: { group_id: BigInt(id), deleted_at: null },
		select: { id: true },
	})

	const templateId = existing ? existing.id : generateId()

	try {
		await prisma.$transaction(async (tx) => {
			if (existing) {
				await tx.doc_approval_templates.update({
					where: { id: existing.id },
					data: { mode: body.mode, updated_at: new Date() },
				})
			}
			else {
				await tx.doc_approval_templates.create({
					data: {
						id: templateId,
						group_id: BigInt(id),
						mode: body.mode,
						timeout_hours: 24,
						enabled: 1, // 模板自身启用标志，业务开关以 doc_groups.approval_enabled 为准，此字段恒为 1
						created_by: BigInt(userId),
					},
				})
			}

			// 删旧 nodes
			await tx.doc_approval_template_nodes.deleteMany({
				where: { template_id: templateId },
			})

			// 批量插入新 nodes，按数组顺序 order_no 从 1 起
			if (body.approverUserIds.length > 0) {
				await tx.doc_approval_template_nodes.createMany({
					data: body.approverUserIds.map((uid, idx) => ({
						id: generateId(),
						template_id: templateId,
						order_no: idx + 1,
						approver_user_id: BigInt(uid),
					})),
				})
			}

			// 更新组总开关
			await tx.doc_groups.update({
				where: { id: BigInt(id) },
				data: { approval_enabled: body.approvalEnabled, updated_at: new Date() },
			})
		})
	}
	catch (error) {
		// 并发场景：两个请求同时走 create 分支，第二个会被 uk_group_deleted 唯一约束拒绝
		if (isDuplicateKeyError(error)) {
			return fail(event, 409, INVALID_PARAMS, '审批配置正在被其他人修改，请刷新后重试')
		}
		throw error
	}

	return ok(null, '审批配置已保存')
})
