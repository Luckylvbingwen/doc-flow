import type { ChainNode } from '~/components/ApprovalChain.vue'

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
