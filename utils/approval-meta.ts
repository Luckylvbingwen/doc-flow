/**
 * 审批中心 UI 元数据（PRD §6.4）
 *
 * 状态色 / 变更类型色按原型 v21 定义
 */
import type { ApprovalStatus, ApprovalChangeType } from '~/types/approval'

export interface StatusMeta {
	label: string
	/** 前景色 */
	color: string
	/** 背景色 */
	bg: string
}

/** 审批状态 → UI meta */
export const APPROVAL_STATUS_META: Record<ApprovalStatus, StatusMeta> = {
	1: { label: '待审批', color: '#6b7280', bg: '#f3f4f6' },
	2: { label: '审批中', color: '#b45309', bg: '#fef3c7' },
	3: { label: '已通过', color: '#15803d', bg: '#dcfce7' },
	4: { label: '已驳回', color: '#b91c1c', bg: '#fee2e2' },
	5: { label: '已撤回', color: '#475569', bg: '#e2e8f0' },
}

/** 变更类型 → UI meta */
export const APPROVAL_CHANGE_TYPE_META: Record<ApprovalChangeType, StatusMeta> = {
	new:     { label: '新增', color: '#15803d', bg: '#dcfce7' }, // 绿
	iterate: { label: '迭代', color: '#1d4ed8', bg: '#dbeafe' }, // 蓝
}

export function getStatusMeta(status: ApprovalStatus): StatusMeta {
	return APPROVAL_STATUS_META[status] ?? { label: '未知', color: '#6b7280', bg: '#f3f4f6' }
}

export function getChangeTypeMeta(type: ApprovalChangeType): StatusMeta {
	return APPROVAL_CHANGE_TYPE_META[type] ?? { label: '', color: '#6b7280', bg: '#f3f4f6' }
}
