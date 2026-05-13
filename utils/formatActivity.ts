/**
 * 操作日志条目格式化
 *
 * 优先级：detail_json.desc > action 模板 > type 类别标签兜底
 *
 * 用法：
 *   import { formatActivity } from '~/utils/formatActivity'
 *   const desc = formatActivity(logRow)
 */
import type { LogItem } from '~/types/log'
import { getLogTypeMeta } from '~/utils/log-types'

interface DetailJson {
	desc?: string
	docTitle?: string
	title?: string
	groupName?: string
	fromGroup?: string
	toGroup?: string
	targetName?: string
	roleName?: string
	count?: number
	versionNo?: string | number
}

function parseDetail(row: LogItem & { detail_json?: unknown }): DetailJson {
	const raw = row.detail_json
	if (!raw) return {}
	if (typeof raw === 'object') return raw as DetailJson
	if (typeof raw === 'string') {
		try { return JSON.parse(raw) } catch { return {} }
	}
	return {}
}

function bookTitle(d: DetailJson): string {
	const t = d.docTitle || d.title || ''
	return t ? `《${t}》` : ''
}

const ACTION_TEMPLATES: Record<string, (row: LogItem, d: DetailJson) => string> = {
	'doc.upload':           (r, d) => `${r.actorName} 上传了文档${bookTitle(d)}`,
	'doc.upload_version':   (r, d) => `${r.actorName} 上传了文档${bookTitle(d)}的新版本${d.versionNo ? ` v${d.versionNo}` : ''}`,
	'doc.rollback':         (r, d) => `${r.actorName} 将文档${bookTitle(d)}回滚至版本${d.versionNo ? ` v${d.versionNo}` : ''}`,
	'doc.draft_create':     (r, d) => `${r.actorName} 新建了草稿${bookTitle(d)}`,
	'doc.edit_save':        (r, d) => `${r.actorName} 保存了文档${bookTitle(d)}的编辑`,
	'doc.download':         (r, d) => `${r.actorName} 下载了文档${bookTitle(d)}`,
	'approval.submit':      (r, d) => `${r.actorName} 提交了文档${bookTitle(d)}的审批申请`,
	'approval.pass':        (r, d) => `${r.actorName} 通过了文档${bookTitle(d)}的审批`,
	'approval.reject':      (r, d) => `${r.actorName} 拒绝了文档${bookTitle(d)}的审批`,
	'approval.withdraw':    (r, d) => `${r.actorName} 撤回了文档${bookTitle(d)}的审批申请`,
	'approval.remind':      (r, d) => `${r.actorName} 催办了文档${bookTitle(d)}的审批`,
	'doc.publish':          (r, d) => `${r.actorName} 发布了文档${bookTitle(d)}`,
	'doc.move.request':     (r, d) => `${r.actorName} 申请将文档${bookTitle(d)}移至「${d.toGroup || ''}」`,
	'doc.move.approve':     (r, d) => `${r.actorName} 批准了文档${bookTitle(d)}的移动申请`,
	'doc.move.reject':      (r, d) => `${r.actorName} 拒绝了文档${bookTitle(d)}的移动申请`,
	'doc.move':             (r, d) => `${r.actorName} 将文档${bookTitle(d)}从「${d.fromGroup || ''}」移至「${d.toGroup || ''}」`,
	'doc.remove':           (r, d) => `${r.actorName} 删除了文档${bookTitle(d)}`,
	'doc.draft_delete':     (r, d) => `${r.actorName} 删除了草稿${bookTitle(d)}`,
	'recycle.restore':      (r, d) => `${r.actorName} 从回收站恢复了文档${bookTitle(d)}`,
	'recycle.purge':        (r, d) => `${r.actorName} 永久删除了文档${bookTitle(d)}`,
	'recycle.auto_purge':   (_, d) => `系统自动清理了文档${bookTitle(d)}`,
	'permission.doc_update':(r, d) => `${r.actorName} 更新了文档${bookTitle(d)}的权限`,
	'permission.group_update': (r, d) => `${r.actorName} 更新了「${d.groupName || ''}」的权限配置`,
	'permission.request_approve': (r, d) => `${r.actorName} 批准了${d.targetName || '用户'}的权限申请`,
	'permission.request_reject':  (r, d) => `${r.actorName} 拒绝了${d.targetName || '用户'}的权限申请`,
	'share.create':         (r, d) => `${r.actorName} 分享了文档${bookTitle(d)}`,
	'member.add':           (r, d) => `${r.actorName} 添加了成员「${d.targetName || ''}」`,
	'member.remove':        (r, d) => `${r.actorName} 移除了成员「${d.targetName || ''}」`,
	'member.feishu_sync':   (_, d) => `系统同步了飞书通讯录${d.count != null ? `（${d.count} 人）` : ''}`,
	'ownership.request':    (r, d) => `${r.actorName} 申请接管文档${bookTitle(d)}`,
	'ownership.approve':    (r, d) => `${r.actorName} 批准了文档${bookTitle(d)}的归属人变更`,
	'ownership.reject':     (r, d) => `${r.actorName} 拒绝了文档${bookTitle(d)}的归属人变更申请`,
	'ownership.handover':   (r, d) => `${r.actorName} 完成了文档${bookTitle(d)}的归属人交接`,
	'comment.add':          (r, d) => `${r.actorName} 在文档${bookTitle(d)}发表了评论`,
	'comment.reply':        (r, d) => `${r.actorName} 回复了文档${bookTitle(d)}中的评论`,
	'comment.delete':       (r, d) => `${r.actorName} 删除了文档${bookTitle(d)}中的评论`,
	'annotation.add':       (r, d) => `${r.actorName} 在文档${bookTitle(d)}添加了批注`,
	'annotation.resolve':   (r, d) => `${r.actorName} 解决了文档${bookTitle(d)}中的批注`,
	'group.create':         (r, d) => `${r.actorName} 创建了文档组「${d.groupName || d.title || ''}」`,
	'group.update':         (r, d) => `${r.actorName} 更新了文档组「${d.groupName || d.title || ''}」的信息`,
	'group.delete':         (r, d) => `${r.actorName} 删除了文档组「${d.groupName || d.title || ''}」`,
	'pl.create':            (r, d) => `${r.actorName} 新建了产品线「${d.title || ''}」`,
	'pl.update':            (r, d) => `${r.actorName} 更新了产品线「${d.title || ''}」的信息`,
	'pl.delete':            (r, d) => `${r.actorName} 删除了产品线「${d.title || ''}」`,
	'favorite.add':         (r, d) => `${r.actorName} 收藏了文档${bookTitle(d)}`,
	'favorite.remove':      (r, d) => `${r.actorName} 取消收藏了文档${bookTitle(d)}`,
	'pin.add':              (r, d) => `${r.actorName} 置顶了文档${bookTitle(d)}`,
	'pin.remove':           (r, d) => `${r.actorName} 取消置顶了文档${bookTitle(d)}`,
	'admin.role_assign':    (r, d) => `${r.actorName} 为「${d.targetName || '用户'}」调整了角色「${d.roleName || ''}」`,
}

export function formatActivity(row: LogItem & { detail_json?: unknown }): string {
	const detail = parseDetail(row)
	if (detail.desc) return detail.desc
	const tplFn = ACTION_TEMPLATES[row.action]
	if (tplFn) return tplFn(row, detail)
	return getLogTypeMeta(row.type).label
}
