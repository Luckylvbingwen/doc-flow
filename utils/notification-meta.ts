// utils/notification-meta.ts
import type { Component } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import {
	AlarmClock, CircleCheck, CircleClose, Document, DocumentChecked,
	Lock, Promotion, Rank, RefreshLeft, Setting, Share, Switch, User, UserFilled, Warning,
} from '@element-plus/icons-vue'
import type { NotificationBizType } from '~/types/notification'

export type NotificationMetaColor = 'primary' | 'success' | 'warning' | 'danger' | 'info'

export interface NotificationMeta {
	icon: Component
	color: NotificationMetaColor
}

/** 按 PRD §6.8.2 的 M1-M24 映射图标和语义色 */
export const NOTIFICATION_META: Record<string, NotificationMeta> = {
	M1: { icon: DocumentChecked, color: 'primary' },
	M2: { icon: DocumentChecked, color: 'primary' },
	M3: { icon: CircleCheck, color: 'success' },
	M4: { icon: CircleClose, color: 'danger' },
	M5: { icon: AlarmClock, color: 'warning' },
	M6: { icon: Warning, color: 'warning' },
	M7: { icon: RefreshLeft, color: 'info' },
	M8: { icon: Promotion, color: 'success' },
	M9: { icon: CircleClose, color: 'danger' },
	M10: { icon: User, color: 'warning' },
	M11: { icon: User, color: 'info' },
	M12: { icon: Rank, color: 'primary' },
	M13: { icon: Rank, color: 'info' },
	M14: { icon: Lock, color: 'warning' },
	M15: { icon: Lock, color: 'warning' },
	M16: { icon: CircleCheck, color: 'success' },
	M17: { icon: Share, color: 'primary' },
	M18: { icon: UserFilled, color: 'success' },
	M19: { icon: UserFilled, color: 'primary' },
	M20: { icon: UserFilled, color: 'danger' },
	M21: { icon: User, color: 'primary' },
	M22: { icon: Switch, color: 'primary' },
	M23: { icon: User, color: 'warning' },
	M24: { icon: Setting, color: 'warning' },
}

/** 未知 msg_code 或 null 的兜底 meta */
export const DEFAULT_META: NotificationMeta = { icon: Document, color: 'info' }

/** 按 msg_code 查 meta，找不到或 msgCode=null 返回 DEFAULT_META */
export function getNotificationMeta(msgCode: string | null): NotificationMeta {
	if (!msgCode) return DEFAULT_META
	return NOTIFICATION_META[msgCode] ?? DEFAULT_META
}

/**
 * 按 biz_type + biz_id 解析跳转路由
 * A 阶段只支持 document / group / group_approval 三种，其他返回 null（不跳转）
 */
export function resolveRoute(bizType: NotificationBizType | null, bizId: string | null): RouteLocationRaw | null {
	if (!bizType || !bizId) return null
	switch (bizType) {
		case 'document':
			return { path: `/docs/file/${bizId}` }
		case 'group':
			return { path: `/docs/repo/${bizId}` }
		case 'group_approval':
			return { path: `/docs/repo/${bizId}`, query: { openSettings: 'approval' } }
		default:
			return null
	}
}
