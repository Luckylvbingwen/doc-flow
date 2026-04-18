/**
 * 审批中心常量（PRD §6.4）
 */

// ─── 审批实例状态 ───
// 对齐 docs/doc.sql 中 doc_approval_instances.status 注释：
// 1待审批 2审批中 3已通过 4已驳回 5已撤回
export const APPROVAL_STATUS = {
	PENDING:   1,
	REVIEWING: 2,
	APPROVED:  3,
	REJECTED:  4,
	WITHDRAWN: 5,
} as const

export type ApprovalStatusCode = typeof APPROVAL_STATUS[keyof typeof APPROVAL_STATUS]

/** 可筛选的状态集合（用户侧：不暴露 PENDING=1，已审批流转即进入 REVIEWING） */
export const APPROVAL_FILTERABLE_STATUSES = [
	APPROVAL_STATUS.REVIEWING,
	APPROVAL_STATUS.APPROVED,
	APPROVAL_STATUS.REJECTED,
	APPROVAL_STATUS.WITHDRAWN,
] as const

// ─── Tab 枚举 ───
// PRD §6.4.1 三个 Tab
export const APPROVAL_TABS = ['pending', 'submitted', 'handled'] as const
export type ApprovalTab = typeof APPROVAL_TABS[number]

// ─── 审批实例节点 action_status ───
// 对齐 doc_approval_instance_nodes.action_status 注释：1待处理 2通过 3驳回
export const NODE_ACTION = {
	PENDING:  1,
	APPROVED: 2,
	REJECTED: 3,
} as const

// ─── 变更类型 ───
// PRD §6.4.2：新增=首次版本；迭代=后续版本
// 判定逻辑：COUNT(doc_document_versions WHERE document_id = ? AND id < biz_id) = 0 → 新增
export const CHANGE_TYPE = {
	NEW:     'new',
	ITERATE: 'iterate',
} as const

export type ChangeTypeCode = typeof CHANGE_TYPE[keyof typeof CHANGE_TYPE]
