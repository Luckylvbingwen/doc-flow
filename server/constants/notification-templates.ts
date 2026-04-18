/**
 * 通知消息模板表（M1-M24，对齐 PRD §6.8.2 消息纵览）
 *
 * 本表是"哪个模块触发哪些通知"的代码级单一事实源。
 * 每个模板含：
 *   - category     — 1 审批 / 2 系统 / 3 成员变更（对齐 doc_notifications.category）
 *   - msgCode      — 'M1' ... 'M24'
 *   - triggerModule — 归属业务模块（用于 grep 反查）
 *   - triggerPoint  — 触发时机人类可读描述
 *   - build(params) — 强类型函数，产出 createNotification 的入参
 *
 * 使用方式（将来的业务 handler）：
 *   import { createNotification } from '~/server/utils/notify'
 *   import { NOTIFICATION_TEMPLATES } from '~/server/constants/notification-templates'
 *   await createNotification(NOTIFICATION_TEMPLATES.M1.build({
 *     toUserId, submitter, fileName, fileId,
 *   }))
 *
 * 反向查询某模块应触发哪些 M 码：
 *   grep "triggerModule: 'approval-runtime'" server/constants/notification-templates.ts
 *
 * 进度追踪：docs/feature-gap-checklist.md 「通知触发点接入清单」章节
 */
import type { CreateNotificationOpts } from '~/server/types/notification'

export type TriggerModule =
	| 'approval-runtime'
	| 'document-lifecycle'
	| 'ownership-transfer'
	| 'cross-move'
	| 'permission-request'
	| 'share'
	| 'group-member'
	| 'role-assign'
	| 'group-owner'
	| 'hr-handover'
	| 'approval-chain-change'

export interface NotificationTemplate<P extends object> {
	category: 1 | 2 | 3
	msgCode: string
	triggerModule: TriggerModule
	triggerPoint: string
	build: (params: P & { toUserId: bigint | number }) => CreateNotificationOpts
}

type ToUser = { toUserId: bigint | number }

export const NOTIFICATION_TEMPLATES = {
	// ==================== 审批类 M1-M7 ====================
	M1: {
		category: 1,
		msgCode: 'M1',
		triggerModule: 'approval-runtime',
		triggerPoint: '文件提交审批（POST /api/approvals）— 通知当前应处理的审批人',
		build: (p: ToUser & { submitter: string, fileName: string, fileId: bigint | number }) => ({
			userId: p.toUserId,
			category: 1 as const,
			msgCode: 'M1',
			title: `${p.submitter} 提交了文件《${p.fileName}》的审批，请处理`,
			bizType: 'document' as const,
			bizId: p.fileId,
		}),
	},
	M2: {
		category: 1,
		msgCode: 'M2',
		triggerModule: 'approval-runtime',
		triggerPoint: '上一级审批人通过，流转到下一级 — 通知下一级审批人',
		build: (p: ToUser & { fileName: string, fileId: bigint | number, currentLevel: number, totalLevel: number }) => ({
			userId: p.toUserId,
			category: 1 as const,
			msgCode: 'M2',
			title: `文件《${p.fileName}》的审批已流转到您（第 ${p.currentLevel}/${p.totalLevel} 级），请处理`,
			bizType: 'document' as const,
			bizId: p.fileId,
		}),
	},
	M3: {
		category: 1,
		msgCode: 'M3',
		triggerModule: 'approval-runtime',
		triggerPoint: '最后一级审批通过 — 通知提交人',
		build: (p: ToUser & { fileName: string, fileId: bigint | number }) => ({
			userId: p.toUserId,
			category: 1 as const,
			msgCode: 'M3',
			title: `您提交的文件《${p.fileName}》已审批通过并发布`,
			bizType: 'document' as const,
			bizId: p.fileId,
		}),
	},
	M4: {
		category: 1,
		msgCode: 'M4',
		triggerModule: 'approval-runtime',
		triggerPoint: '任一级审批人驳回 — 通知提交人（reason 存 content）',
		// PRD §6.8.2 原模板："您提交的文件《{文件名}》被驳回，原因：{驳回原因}，请补充后重新提交"
		// 实现刻意将「原因：xxx」从 title 拆到 content，以便 NotificationCard 两行显示（title + content 副文案）
		build: (p: ToUser & { fileName: string, fileId: bigint | number, reason: string }) => ({
			userId: p.toUserId,
			category: 1 as const,
			msgCode: 'M4',
			title: `您提交的文件《${p.fileName}》被驳回，请补充后重新提交`,
			content: p.reason,
			bizType: 'document' as const,
			bizId: p.fileId,
		}),
	},
	M5: {
		category: 1,
		msgCode: 'M5',
		triggerModule: 'approval-runtime',
		triggerPoint: '审批超过 24h 未处理 — 通知该步审批人',
		build: (p: ToUser & { fileName: string, fileId: bigint | number, overdueHours: number }) => ({
			userId: p.toUserId,
			category: 1 as const,
			msgCode: 'M5',
			title: `文件《${p.fileName}》的审批已超时 ${p.overdueHours} 小时，请尽快处理`,
			bizType: 'document' as const,
			bizId: p.fileId,
		}),
	},
	M6: {
		category: 1,
		msgCode: 'M6',
		triggerModule: 'approval-runtime',
		triggerPoint: '系统催办达上限 — 通知提交人',
		build: (p: ToUser & { fileName: string, fileId: bigint | number, maxTimes: number }) => ({
			userId: p.toUserId,
			category: 1 as const,
			msgCode: 'M6',
			title: `文件《${p.fileName}》的审批催办已达上限（${p.maxTimes} 次），您可撤回重新提交`,
			bizType: 'document' as const,
			bizId: p.fileId,
		}),
	},
	M7: {
		category: 1,
		msgCode: 'M7',
		triggerModule: 'approval-runtime',
		triggerPoint: '提交人撤回审批 — 通知已参与审批的所有审批人',
		build: (p: ToUser & { submitter: string, fileName: string, fileId: bigint | number }) => ({
			userId: p.toUserId,
			category: 1 as const,
			msgCode: 'M7',
			title: `${p.submitter} 已撤回文件《${p.fileName}》的审批`,
			bizType: 'document' as const,
			bizId: p.fileId,
		}),
	},

	// ==================== 文档生命周期 M8-M9 ====================
	M8: {
		category: 2,
		msgCode: 'M8',
		triggerModule: 'document-lifecycle',
		triggerPoint: '审批通过后发布 — 通知归属人 + 可编辑成员 + 组管理员',
		build: (p: ToUser & { fileName: string, fileId: bigint | number, version: string }) => ({
			userId: p.toUserId,
			category: 2 as const,
			msgCode: 'M8',
			title: `文件《${p.fileName}》已发布新版本 ${p.version}`,
			bizType: 'document' as const,
			bizId: p.fileId,
		}),
	},
	M9: {
		category: 2,
		msgCode: 'M9',
		triggerModule: 'document-lifecycle',
		triggerPoint: '管理员从组移除文档 — 通知文档归属人',
		build: (p: ToUser & { operator: string, fileName: string, fileId: bigint | number, groupName: string }) => ({
			userId: p.toUserId,
			category: 2 as const,
			msgCode: 'M9',
			title: `管理员 ${p.operator} 已将文件《${p.fileName}》从组《${p.groupName}》中移除，文档已退回您的个人中心`,
			bizType: 'document' as const,
			bizId: p.fileId,
		}),
	},

	// ==================== 归属人转移 M10-M11 ====================
	M10: {
		category: 2,
		msgCode: 'M10',
		triggerModule: 'ownership-transfer',
		triggerPoint: '发起归属人转移 — 通知目标新归属人',
		build: (p: ToUser & { initiator: string, fileName: string }) => ({
			userId: p.toUserId,
			category: 2 as const,
			msgCode: 'M10',
			title: `${p.initiator} 希望将文件《${p.fileName}》的归属人转移给您，请处理`,
		}),
	},
	M11: {
		category: 2,
		msgCode: 'M11',
		triggerModule: 'ownership-transfer',
		triggerPoint: '转移同意/拒绝/过期 — 通知发起人',
		build: (p: ToUser & { fileName: string, result: '已同意' | '已拒绝' | '已过期' }) => ({
			userId: p.toUserId,
			category: 2 as const,
			msgCode: 'M11',
			title: `文件《${p.fileName}》的归属人转移${p.result}`,
		}),
	},

	// ==================== 跨组移动 M12-M13 ====================
	M12: {
		category: 2,
		msgCode: 'M12',
		triggerModule: 'cross-move',
		triggerPoint: '发起跨组移动 — 通知目标组负责人',
		build: (p: ToUser & { initiator: string, fileName: string, fromGroup: string, toGroup: string }) => ({
			userId: p.toUserId,
			category: 2 as const,
			msgCode: 'M12',
			title: `${p.initiator} 申请将文件《${p.fileName}》从组《${p.fromGroup}》移动到您负责的组《${p.toGroup}》`,
		}),
	},
	M13: {
		category: 2,
		msgCode: 'M13',
		triggerModule: 'cross-move',
		triggerPoint: '移动同意/拒绝/过期 — 通知发起人',
		build: (p: ToUser & { fileName: string, result: '已同意' | '已拒绝' | '已过期' }) => ({
			userId: p.toUserId,
			category: 2 as const,
			msgCode: 'M13',
			title: `文件《${p.fileName}》的跨组移动申请${p.result}`,
		}),
	},

	// ==================== 权限申请 M14-M16 ====================
	M14: {
		category: 2,
		msgCode: 'M14',
		triggerModule: 'permission-request',
		triggerPoint: '无权限用户申请阅读 — 通知文档归属人',
		build: (p: ToUser & { applicant: string, fileName: string }) => ({
			userId: p.toUserId,
			category: 2 as const,
			msgCode: 'M14',
			title: `${p.applicant} 申请阅读文件《${p.fileName}》`,
		}),
	},
	M15: {
		category: 2,
		msgCode: 'M15',
		triggerModule: 'permission-request',
		triggerPoint: '可阅读用户申请升级编辑 — 通知归属人（reason 存 content）',
		// PRD §6.8.2 原模板："{申请人} 申请文件《{文件名}》的编辑权限，理由：{申请理由}"
		// 实现刻意将「理由：xxx」从 title 拆到 content，NotificationCard 两行显示
		build: (p: ToUser & { applicant: string, fileName: string, reason: string }) => ({
			userId: p.toUserId,
			category: 2 as const,
			msgCode: 'M15',
			title: `${p.applicant} 申请文件《${p.fileName}》的编辑权限`,
			content: p.reason,
		}),
	},
	M16: {
		category: 2,
		msgCode: 'M16',
		triggerModule: 'permission-request',
		triggerPoint: '权限审批同意/拒绝 — 通知申请人',
		build: (p: ToUser & { fileName: string, permType: '阅读' | '编辑', result: '已同意' | '已拒绝' }) => ({
			userId: p.toUserId,
			category: 2 as const,
			msgCode: 'M16',
			title: `您对文件《${p.fileName}》的${p.permType}权限申请${p.result}`,
		}),
	},

	// ==================== 分享 M17 ====================
	M17: {
		category: 2,
		msgCode: 'M17',
		triggerModule: 'share',
		triggerPoint: '分享文档给指定用户 — 通知被分享人',
		build: (p: ToUser & { sharer: string, fileName: string, fileId: bigint | number, permLabel: string }) => ({
			userId: p.toUserId,
			category: 2 as const,
			msgCode: 'M17',
			title: `${p.sharer} 向您分享了文件《${p.fileName}》（${p.permLabel}）`,
			bizType: 'document' as const,
			bizId: p.fileId,
		}),
	},

	// ==================== 成员变更 M18-M23 ====================
	M18: {
		category: 3,
		msgCode: 'M18',
		triggerModule: 'group-member',
		triggerPoint: '被加入组 — 通知被添加的成员',
		build: (p: ToUser & { groupName: string, groupId: bigint | number, permLabel: string }) => ({
			userId: p.toUserId,
			category: 3 as const,
			msgCode: 'M18',
			title: `您已被添加为组《${p.groupName}》的成员（权限：${p.permLabel}）`,
			bizType: 'group' as const,
			bizId: p.groupId,
		}),
	},
	M19: {
		category: 3,
		msgCode: 'M19',
		triggerModule: 'group-member',
		triggerPoint: '组内权限调整 — 通知被变更成员',
		build: (p: ToUser & { groupName: string, oldLabel: string, newLabel: string }) => ({
			userId: p.toUserId,
			category: 3 as const,
			msgCode: 'M19',
			title: `您在组《${p.groupName}》的权限已从「${p.oldLabel}」变更为「${p.newLabel}」`,
		}),
	},
	M20: {
		category: 3,
		msgCode: 'M20',
		triggerModule: 'group-member',
		triggerPoint: '被移出组 — 通知被移出成员',
		build: (p: ToUser & { groupName: string }) => ({
			userId: p.toUserId,
			category: 3 as const,
			msgCode: 'M20',
			title: `您已被移出组《${p.groupName}》`,
		}),
	},
	M21: {
		category: 3,
		msgCode: 'M21',
		triggerModule: 'role-assign',
		triggerPoint: '管理员角色指派/撤销 — 通知被指派/撤销用户',
		// PRD §6.8.2 两种变体：
		//   - action='assign'  → 您已被指派为{角色名称}（{管理范围}）
		//   - action='revoke'  → 您的{角色名称}身份已被撤销
		build: (
			p: ToUser & (
				| { action: 'assign', roleName: string, scope: string }
				| { action: 'revoke', roleName: string }
			),
		): CreateNotificationOpts => {
			const title = p.action === 'assign'
				? `您已被指派为${p.roleName}（${p.scope}）`
				: `您的${p.roleName}身份已被撤销`
			return {
				userId: p.toUserId,
				category: 3 as const,
				msgCode: 'M21',
				title,
			}
		},
	},
	M22: {
		category: 3,
		msgCode: 'M22',
		triggerModule: 'group-owner',
		triggerPoint: '组负责人变更 — 通知新负责人 + 组内成员',
		build: (p: ToUser & { groupName: string, groupId: bigint | number, oldOwner: string, newOwner: string }) => ({
			userId: p.toUserId,
			category: 3 as const,
			msgCode: 'M22',
			title: `组《${p.groupName}》的负责人已由 ${p.oldOwner} 变更为 ${p.newOwner}`,
			bizType: 'group' as const,
			bizId: p.groupId,
		}),
	},
	M23: {
		category: 3,
		msgCode: 'M23',
		triggerModule: 'hr-handover',
		triggerPoint: '员工离职触发交接 — 通知部门负责人',
		build: (p: ToUser & { leaver: string, groupName: string, groupId: bigint | number, successor: string }) => ({
			userId: p.toUserId,
			category: 3 as const,
			msgCode: 'M23',
			title: `员工 ${p.leaver} 已离职，其负责的组《${p.groupName}》已交接给 ${p.successor}，请确认`,
			bizType: 'group' as const,
			bizId: p.groupId,
		}),
	},

	// ==================== 审批链变更 M24 ====================
	M24: {
		category: 2,
		msgCode: 'M24',
		triggerModule: 'approval-chain-change',
		triggerPoint: '审批链成员因离职/调岗被移除 — 通知组负责人/管理员',
		build: (p: ToUser & { memberName: string, groupName: string, groupId: bigint | number, reason: string }) => ({
			userId: p.toUserId,
			category: 2 as const,
			msgCode: 'M24',
			title: `成员 ${p.memberName} 已从组《${p.groupName}》的审批链中移除（${p.reason}），请检查审批配置`,
			bizType: 'group_approval' as const,
			bizId: p.groupId,
		}),
	},
} as const
