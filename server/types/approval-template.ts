/**
 * 组审批模板 — 服务端 DB 行类型
 */

/** 审批模板行（查询用） */
export interface ApprovalTemplateRow {
	id: bigint | number
	group_id: bigint | number
	mode: number
	timeout_hours: number
	/** 模板行本身的启用标志（冗余字段，业务开关以 doc_groups.approval_enabled 为准，此字段保留不用） */
	enabled: number
}

/** 审批模板节点行（含审批人用户信息） */
export interface ApprovalTemplateNodeRow {
	order_no: number
	approver_user_id: bigint | number
	name: string
	avatar_url: string | null
}

/** 活跃用户校验行 */
export interface ActiveUserRow {
	id: bigint | number
}
