/**
 * 文档 UI 元数据（跨页面复用：个人中心 / 共享文档组面板 / 文件详情 / 回收站 等）
 *   - 文档状态色（PRD §5.3 状态说明）
 *   - 来源徽章色（PRD §6.5.2 来源标签）
 *   - 权限级别徽章色（§6.5.2 "分享给我的"权限标签）
 */
import type { DocStatus, ItemSource } from '~/types/personal'

export interface BadgeMeta {
	label: string
	color: string
	bg: string
}

/** 文档状态 → UI meta（对齐 doc_documents.status） */
export const DOC_STATUS_META: Record<DocStatus, BadgeMeta> = {
	1: { label: '草稿', color: '#475569', bg: '#e2e8f0' },
	2: { label: '编辑中', color: '#1d4ed8', bg: '#dbeafe' },
	3: { label: '审批中', color: '#b45309', bg: '#fef3c7' },
	4: { label: '已发布', color: '#15803d', bg: '#dcfce7' },
	5: { label: '已驳回', color: '#b91c1c', bg: '#fee2e2' },
	6: { label: '已删除', color: '#6b7280', bg: '#f3f4f6' },
}

/** 来源 → UI meta（PRD §6.5.2 "全部"TAB） */
export const ITEM_SOURCE_META: Record<ItemSource, BadgeMeta> = {
	mine: { label: '我创建的', color: '#1d4ed8', bg: '#dbeafe' },
	shared: { label: '分享给我的', color: '#7c3aed', bg: '#ede9fe' },
	favorite: { label: '共享文档', color: '#15803d', bg: '#dcfce7' },
}

export function getDocStatusMeta(status: DocStatus): BadgeMeta {
	return DOC_STATUS_META[status] ?? { label: '未知', color: '#6b7280', bg: '#f3f4f6' }
}

export function getItemSourceMeta(source: ItemSource): BadgeMeta {
	return ITEM_SOURCE_META[source] ?? { label: '', color: '#6b7280', bg: '#f3f4f6' }
}

/**
 * 权限级别徽章（4 值齐全：管理员 / 可编辑 / 上传下载 / 可阅读）
 * 实现迁到 utils/permission-meta.ts 集中管理；此处保留导出以维持向后兼容
 */
export { getPermissionMeta as getPermissionLevelMeta, PERMISSION_META as PERMISSION_LEVEL_META } from '~/utils/permission-meta'
