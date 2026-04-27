/**
 * 个人中心常量（PRD §6.5）
 */

/** Tab：全部 / 我创建的 / 分享给我的 / 个人收藏 / 离职移交 */
export const PERSONAL_TABS = ['all', 'mine', 'shared', 'favorite', 'handover'] as const
export type PersonalTab = typeof PERSONAL_TABS[number]

/**
 * 状态筛选集合（PRD §6.5.2 筛选与搜索）
 *   1 草稿 / 2 编辑中 / 3 审批中 / 4 已发布
 *   5 已驳回 / 6 已删除 不作为用户侧筛选选项
 */
export const PERSONAL_FILTERABLE_STATUSES = [1, 2, 3, 4] as const
export type PersonalStatusCode = typeof PERSONAL_FILTERABLE_STATUSES[number]

/**
 * 列表项来源（PRD §6.5.2 "全部"TAB 来源徽章）
 *   mine     — 我创建的
 *   shared   — 他人分享给我的
 *   favorite — 共享文档里的个人收藏
 */
export const ITEM_SOURCE = {
	MINE: 'mine',
	SHARED: 'shared',
	FAVORITE: 'favorite',
} as const
export type ItemSourceCode = typeof ITEM_SOURCE[keyof typeof ITEM_SOURCE]

/**
 * 文档级权限 — 重导出 server/constants/permission.ts 的统一定义
 * 历史值 (1=可编辑/2=可阅读) 已通过 patch-008 迁移到 (2=可编辑/4=可阅读)
 */
export { PERMISSION_LEVEL, type PermissionLevelCode } from './permission'
