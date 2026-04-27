/**
 * PUT /api/documents/:id/permissions
 * 文档级权限弹窗 — 整包替换（PRD §6.3.4 "保存权限"按钮）
 *
 * body: { perms: [{ userId, permission }, ...] }（草稿模式：本地编辑全部完成后一次提交）
 *
 * 鉴权：登录 + 组管理员（与 GET 同口径，requireMemberPermission）
 *
 * 业务规则：
 *   - 文档必须归组（个人草稿态拒绝设置）
 *   - 目标 user 必须是该组的活跃成员（按 PRD line 6024 "仅限组成员"）
 *   - 不允许给组负责人 owner_user_id 设置文档级权限（语义上"覆盖"对最高权限无意义）
 *   - permission 仅限 [2可编辑, 3上传下载]（DOC_CUSTOM_PERMISSION_LEVELS）
 *
 * 事务流程：
 *   1. 拉当前未软删的 doc_document_permissions 行（按 user_id 索引）
 *   2. 与 body.perms 比对：
 *      - 新条目 → INSERT  → 写日志 desc:"为「张三」设置文档级权限「可编辑」"
 *      - 已有但 permission 不同 → UPDATE → 写日志 desc:"将「王五」的文档级权限从「上传下载」升级/降级为「可编辑」"
 *      - 已有但不在 body 中 → 软删 → 写日志 desc:"移除「李四」的文档级权限"
 *   3. 一事件一日志：每条 diff 写一条 PERMISSION_DOC_UPDATE 日志
 *
 * 返回：{ inserted, updated, removed }（统计）
 */
import type { Prisma } from '@prisma/client'
import { prisma } from '~/server/utils/prisma'
import { generateId } from '~/server/utils/snowflake'
import { requireMemberPermission } from '~/server/utils/group-permission'
import { docPermissionPutSchema } from '~/server/schemas/document-permission'
import {
	PERMISSION_LABEL,
	type PermissionLevelCode,
} from '~/server/constants/permission'
import { LOG_ACTIONS } from '~/server/constants/log-actions'
import {
	INVALID_PARAMS,
	DOCUMENT_NOT_FOUND,
	DOC_PERMISSION_NOT_IN_GROUP,
	DOC_PERMISSION_NOT_GROUP_MEMBER,
	DOC_PERMISSION_TARGET_INVALID,
} from '~/server/constants/error-codes'

interface ExistRow {
	id: bigint
	user_id: bigint
	permission: number
}

export default defineEventHandler(async (event) => {
	const idStr = getRouterParam(event, 'id')
	if (!idStr || !/^\d+$/.test(idStr)) {
		return fail(event, 400, INVALID_PARAMS, '文档 ID 非法')
	}
	const docId = BigInt(idStr)
	const userId = event.context.user!.id

	const body = await readValidatedBody(event, docPermissionPutSchema.parse)

	const doc = await prisma.doc_documents.findFirst({
		where: { id: docId, deleted_at: null },
		select: { id: true, group_id: true, title: true },
	})
	if (!doc) return fail(event, 404, DOCUMENT_NOT_FOUND, '文档不存在')
	if (!doc.group_id) {
		return fail(event, 409, DOC_PERMISSION_NOT_IN_GROUP, '该文档未归属任何组，无法设置文档级权限')
	}

	const group = await prisma.doc_groups.findUnique({
		where: { id: doc.group_id },
		select: { id: true, scope_type: true, scope_ref_id: true, owner_user_id: true, name: true },
	})
	if (!group) return fail(event, 404, DOCUMENT_NOT_FOUND, '文档所属组不存在')

	const permErr = await requireMemberPermission(event, {
		groupId: Number(group.id),
		scopeType: group.scope_type,
		scopeRefId: group.scope_ref_id != null ? Number(group.scope_ref_id) : null,
		ownerUserId: group.owner_user_id != null ? Number(group.owner_user_id) : null,
	})
	if (permErr) return permErr

	// 不允许给组负责人设置（覆盖最高权限无意义；前端也不应展示该选项）
	if (group.owner_user_id) {
		const ownerId = Number(group.owner_user_id)
		if (body.perms.some(p => p.userId === ownerId)) {
			return fail(event, 400, DOC_PERMISSION_TARGET_INVALID, '不允许给组负责人设置文档级权限')
		}
	}

	// 校验目标 user 必须是该组的活跃成员
	const targetUserIds = body.perms.map(p => BigInt(p.userId))
	if (targetUserIds.length > 0) {
		const memberRows = await prisma.doc_group_members.findMany({
			where: { group_id: group.id, deleted_at: null, user_id: { in: targetUserIds } },
			select: { user_id: true, doc_users_doc_group_members_user_idTodoc_users: { select: { name: true } } },
		})
		const validUserIds = new Set(memberRows.map(r => Number(r.user_id)))
		const missing = body.perms.find(p => !validUserIds.has(p.userId))
		if (missing) {
			return fail(
				event, 400, DOC_PERMISSION_NOT_GROUP_MEMBER,
				`用户 #${missing.userId} 不是该组的成员，无法设置文档级权限`,
			)
		}
	}

	// 拉当前未软删条目
	const existRows = await prisma.$queryRaw<ExistRow[]>`
		SELECT id, user_id, permission
		FROM doc_document_permissions
		WHERE document_id = ${docId} AND deleted_at IS NULL
	`
	const existByUser = new Map<number, ExistRow>()
	for (const r of existRows) existByUser.set(Number(r.user_id), r)

	const targetByUser = new Map<number, PermissionLevelCode>()
	for (const p of body.perms) targetByUser.set(p.userId, p.permission as PermissionLevelCode)

	// 解析 diff
	type Diff =
		| { kind: 'insert'; userId: number; permission: PermissionLevelCode }
		| { kind: 'update'; rowId: bigint; userId: number; oldPerm: PermissionLevelCode; newPerm: PermissionLevelCode }
		| { kind: 'delete'; rowId: bigint; userId: number; oldPerm: PermissionLevelCode }

	const diffs: Diff[] = []
	for (const [uid, newPerm] of targetByUser) {
		const exist = existByUser.get(uid)
		if (!exist) {
			diffs.push({ kind: 'insert', userId: uid, permission: newPerm })
		} else if (Number(exist.permission) !== newPerm) {
			diffs.push({
				kind: 'update', rowId: exist.id, userId: uid,
				oldPerm: Number(exist.permission) as PermissionLevelCode, newPerm,
			})
		}
	}
	for (const [uid, exist] of existByUser) {
		if (!targetByUser.has(uid)) {
			diffs.push({
				kind: 'delete', rowId: exist.id, userId: uid,
				oldPerm: Number(exist.permission) as PermissionLevelCode,
			})
		}
	}

	if (diffs.length === 0) {
		return ok({ inserted: 0, updated: 0, removed: 0 })
	}

	// 拿目标用户姓名映射，用于日志 desc 文案
	const allInvolvedUserIds = Array.from(new Set(diffs.map(d => d.userId)))
	const userRows = await prisma.doc_users.findMany({
		where: { id: { in: allInvolvedUserIds.map(BigInt) } },
		select: { id: true, name: true },
	})
	const nameById = new Map<number, string>()
	for (const u of userRows) nameById.set(Number(u.id), u.name)

	const now = new Date()
	let inserted = 0
	let updated = 0
	let removed = 0

	await prisma.$transaction(async (tx) => {
		for (const d of diffs) {
			if (d.kind === 'insert') {
				await tx.doc_document_permissions.create({
					data: {
						id: generateId(),
						document_id: docId,
						user_id: BigInt(d.userId),
						permission: d.permission,
						granted_by: BigInt(userId),
						created_at: now,
						updated_at: now,
					},
				})
				inserted++
			} else if (d.kind === 'update') {
				await tx.doc_document_permissions.update({
					where: { id: d.rowId },
					data: { permission: d.newPerm, updated_at: now },
				})
				updated++
			} else {
				await tx.doc_document_permissions.update({
					where: { id: d.rowId },
					data: { deleted_at: now, updated_at: now },
				})
				removed++
			}
		}

		// 一事件一日志：每条 diff 写一条 PERMISSION_DOC_UPDATE
		await tx.doc_operation_logs.createMany({
			data: diffs.map((d) => {
				const targetName = nameById.get(d.userId) ?? `用户#${d.userId}`
				let desc: string
				let detail: Record<string, unknown>
				if (d.kind === 'insert') {
					desc = `为「${targetName}」设置文档级权限「${PERMISSION_LABEL[d.permission]}」`
					detail = { desc, action: 'insert', userId: d.userId, permission: d.permission }
				} else if (d.kind === 'update') {
					const direction = d.newPerm < d.oldPerm ? '升级' : '降级'
					desc = `将「${targetName}」的文档级权限从「${PERMISSION_LABEL[d.oldPerm]}」${direction}为「${PERMISSION_LABEL[d.newPerm]}」`
					detail = { desc, action: 'update', userId: d.userId, oldPerm: d.oldPerm, newPerm: d.newPerm }
				} else {
					desc = `移除「${targetName}」的文档级权限`
					detail = { desc, action: 'delete', userId: d.userId, oldPerm: d.oldPerm }
				}
				return {
					id: generateId(),
					actor_user_id: BigInt(userId),
					action: LOG_ACTIONS.PERMISSION_DOC_UPDATE,
					target_type: 'document',
					target_id: docId,
					group_id: group.id,
					document_id: docId,
					detail_json: detail as Prisma.InputJsonValue,
				}
			}),
		})
	})

	return ok({ inserted, updated, removed }, '文档权限已保存')
})
