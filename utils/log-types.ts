/**
 * 操作日志 14 大类 UI 元数据
 * 对齐 PRD §6.7.2
 *
 * 每类提供:
 *   - label:  中文名（筛选下拉 + 标签文字）
 *   - icon:   Element Plus 图标组件（来自 @element-plus/icons-vue）
 *   - color:  前景色（文字 + 图标）
 *   - bg:     背景色（tag 底色）
 *
 * 与后端 server/constants/log-actions.ts 的 LOG_TYPES 保持同步
 */
import type { Component } from 'vue'
import {
	Top,
	EditPen,
	Bottom,
	CircleCheck,
	Promotion,
	Sort,
	Delete,
	Lock,
	Share,
	UserFilled,
	Avatar,
	ChatDotRound,
	OfficeBuilding,
	StarFilled,
	Tickets,
} from '@element-plus/icons-vue'

export type LogTypeCode =
	| 'file_upload'
	| 'file_edit'
	| 'file_download'
	| 'approval'
	| 'file_publish'
	| 'file_move'
	| 'file_remove'
	| 'permission'
	| 'share'
	| 'member'
	| 'ownership'
	| 'comment'
	| 'org'
	| 'favorite_pin'

export interface LogTypeMeta {
	code: LogTypeCode
	label: string
	icon: Component
	color: string
	bg: string
}

/** 14 大类 — 顺序即筛选下拉顺序 */
export const LOG_TYPE_META: LogTypeMeta[] = [
	{ code: 'file_upload',   label: '文件上传',   icon: Top,            color: '#2563eb', bg: '#eff6ff' },
	{ code: 'file_edit',     label: '文件编辑',   icon: EditPen,        color: '#0891b2', bg: '#ecfeff' },
	{ code: 'file_download', label: '文件下载',   icon: Bottom,         color: '#475569', bg: '#f1f5f9' },
	{ code: 'approval',      label: '审批操作',   icon: CircleCheck,    color: '#7c3aed', bg: '#f3e8ff' },
	{ code: 'file_publish',  label: '文件发布',   icon: Promotion,      color: '#059669', bg: '#d1fae5' },
	{ code: 'file_move',     label: '文件移动',   icon: Sort,           color: '#0369a1', bg: '#e0f2fe' },
	{ code: 'file_remove',   label: '文件移除',   icon: Delete,         color: '#dc2626', bg: '#fee2e2' },
	{ code: 'permission',    label: '权限变更',   icon: Lock,           color: '#c2410c', bg: '#ffedd5' },
	{ code: 'share',         label: '分享',       icon: Share,          color: '#0d9488', bg: '#ccfbf1' },
	{ code: 'member',        label: '成员变更',   icon: UserFilled,     color: '#a16207', bg: '#fef9c3' },
	{ code: 'ownership',     label: '归属人变更', icon: Avatar,         color: '#b91c1c', bg: '#fee2e2' },
	{ code: 'comment',       label: '评论批注',   icon: ChatDotRound,   color: '#1d4ed8', bg: '#dbeafe' },
	{ code: 'org',           label: '组织管理',   icon: OfficeBuilding, color: '#4338ca', bg: '#e0e7ff' },
	{ code: 'favorite_pin',  label: '收藏置顶',   icon: StarFilled,     color: '#d97706', bg: '#fef3c7' },
]

const metaMap: Record<LogTypeCode, LogTypeMeta> = Object.fromEntries(
	LOG_TYPE_META.map(m => [m.code, m]),
) as Record<LogTypeCode, LogTypeMeta>

/** 按类型码查 UI 元数据；未知类型回落到中性色 + 默认图标 */
export function getLogTypeMeta(code: string): LogTypeMeta {
	return metaMap[code as LogTypeCode] ?? {
		code: code as LogTypeCode,
		label: code,
		icon: Tickets,
		color: '#64748b',
		bg: '#f1f5f9',
	}
}
