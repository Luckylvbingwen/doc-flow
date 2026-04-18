import type { ChainNode } from '~/components/ApprovalChain.vue'

// ==========================================================
// 审批中心列表项（PRD §6.4）— 用于 /api/approvals 接口
// ==========================================================

/** Tab：待我审批 / 我发起的 / 我已处理 */
export type ApprovalTab = 'pending' | 'submitted' | 'handled'

/**
 * 审批状态码（与后端 doc_approval_instances.status 对齐）
 *   1 待审批  2 审批中  3 已通过  4 已驳回  5 已撤回
 */
export type ApprovalStatus = 1 | 2 | 3 | 4 | 5

/** 变更类型（PRD §6.4.2：首版本=new / 后续版本=iterate） */
export type ApprovalChangeType = 'new' | 'iterate'

/** 审批列表单项 */
export interface ApprovalItem {
	/** 审批实例 ID */
	id: number
	status: ApprovalStatus
	documentId: number
	/** 文件名 */
	title: string
	/** 扩展名 */
	ext: string
	/** 提审版本 ID */
	versionId: number
	/** 版本号（如 v1.0） */
	versionNo: string
	/** 新增 / 迭代 */
	changeType: ApprovalChangeType
	/** 所属组 ID */
	groupId: number | null
	/** 所属组名 */
	groupName: string
	/** 发起人 ID */
	initiatorId: number
	/** 发起人姓名 */
	initiatorName: string
	/** 提交时间（毫秒时间戳） */
	submittedAt: number
	/** 处理时间（毫秒时间戳，handled tab 或 已结束实例） */
	handledAt: number | null
	/** 当前待审批人姓名（pending / submitted reviewing 状态） */
	currentApproverName: string | null
	/** 所有审批人姓名（逗号分隔） */
	allApproverNames: string
	/** 驳回原因（submitted rejected / handled 的驳回记录） */
	rejectReason: string | null
	/** 当前节点催办次数 */
	remindCount: number
	/** 是否允许撤回（仅 submitted + reviewing） */
	canWithdraw: boolean
}

export interface ApprovalListQuery {
	tab: ApprovalTab
	status?: ApprovalStatus
	page?: number
	pageSize?: number
}

// ==========================================================
// 审批详情（旧，用于 ApprovalDrawer；后续审批流运行时继续使用）
// ==========================================================

/** 变更摘要条目 */
export interface ChangeSummaryItem {
	type: 'add' | 'mod' | 'del'
	text: string
}

/** 审批详情数据 */
export interface ApprovalDetail {
	id: number | string
	/** 文件名 */
	fileName: string
	/** 文件类型 (docx/xlsx/pdf/md) */
	fileType: string
	/** 所属组 */
	repo: string
	/** 上传者 */
	uploader: string
	/** 上传时间 */
	uploadTime: string
	/** 当前版本 */
	version: string
	/** 对比基线版本 */
	prevVersion?: string
	/** 文件大小变化描述 */
	sizeChange?: string
	/** 变更明细 */
	changes: ChangeSummaryItem[]
	/** 审批链节点 */
	chain: ChainNode[]
	/** 审批状态 */
	status: 'pending' | 'approved' | 'rejected'
}
