/**
 * 统一消息反馈工具
 *
 * Nuxt 自动导入，页面/组件中直接调用即可：
 *   msgSuccess('保存成功')
 *   msgError('操作失败')
 *   const ok = await msgConfirm('确定删除？')
 */

import { ElMessage, ElMessageBox, ElNotification } from 'element-plus'
import type { VNode } from 'vue'

type MsgType = 'success' | 'warning' | 'info' | 'error'

interface NotifyOptions {
	/** 通知标题 */
	title: string
	/** 通知正文，支持字符串或 VNode */
	message: string | VNode
	/** 类型，默认 'info' */
	type?: MsgType
	/** 持续时间(ms)，0 = 不自动关闭。默认: error 6000, 其余 3500 */
	duration?: number
	/** 是否可手动关闭，默认 true */
	closable?: boolean
	/** 点击回调 */
	onClick?: () => void
}

interface ConfirmOptions {
	/** 弹窗类型图标，默认 'warning' */
	type?: 'warning' | 'error' | 'info'
	/** 确认按钮文字 */
	confirmText?: string
	/** 取消按钮文字 */
	cancelText?: string
	/** 确认按钮是否为危险色 */
	danger?: boolean
}

// ─── 轻量 Toast ─────────────────────────────────
// 顶部居中，自动消失，适合 CRUD 即时反馈

export const msgSuccess = (msg: string) =>
	ElMessage({ message: msg, type: 'success', grouping: true, duration: 2000 })

export const msgError = (msg: string) =>
	ElMessage({ message: msg, type: 'error', grouping: true, duration: 3500 })

export const msgWarning = (msg: string) =>
	ElMessage({ message: msg, type: 'warning', grouping: true, duration: 3000 })

export const msgInfo = (msg: string) =>
	ElMessage({ message: msg, type: 'info', grouping: true, duration: 2000 })

// ─── 右上角通知卡片 ─────────────────────────────
// 支持标题 + 正文，适合异步任务完成、WebSocket 推送、带详情的反馈

export const msgNotify = (options: NotifyOptions) =>
	ElNotification({
		title: options.title,
		message: options.message,
		type: options.type ?? 'info',
		duration: options.duration ?? (options.type === 'error' ? 6000 : 3500),
		showClose: options.closable ?? true,
		onClick: options.onClick,
	})

// 快捷通知
msgNotify.success = (title: string, message: string, duration?: number) =>
	msgNotify({ title, message, type: 'success', duration })

msgNotify.error = (title: string, message: string, duration?: number) =>
	msgNotify({ title, message, type: 'error', duration })

msgNotify.warning = (title: string, message: string, duration?: number) =>
	msgNotify({ title, message, type: 'warning', duration })

msgNotify.info = (title: string, message: string, duration?: number) =>
	msgNotify({ title, message, type: 'info', duration })

// ─── 错误详情联动 ────────────────────────────────
// 短消息走 toast，长消息 / 带详情自动升级为右上角通知

export const msgErrorDetail = (msg: string, detail?: string) => {
	if (!detail) return msgError(msg)
	return msgNotify({
		title: msg,
		message: detail,
		type: 'error',
		duration: 8000,
	})
}

// ─── 模态确认拦截 ────────────────────────────────
// 用于删除、批量操作等危险动作前的二次确认
// 返回 Promise<boolean>，用户取消时返回 false（不抛异常）

export const msgConfirm = async (
	message: string,
	title = '操作确认',
	options?: ConfirmOptions,
): Promise<boolean> => {
	try {
		await ElMessageBox.confirm(message, title, {
			type: options?.type ?? 'warning',
			confirmButtonText: options?.confirmText ?? '确定',
			cancelButtonText: options?.cancelText ?? '取消',
			confirmButtonClass: options?.danger ? 'el-button--danger' : '',
			closeOnClickModal: false,
			// 嵌套弹窗场景 Element Plus 的 z-index 计数器不共享，强制提高以免被外层 dialog 盖住
			modalClass: 'df-msgbox-on-top',
			customClass: 'df-msgbox-on-top',
		})
		return true
	} catch {
		return false
	}
}

// ─── 模态结果通知 ────────────────────────────────
// 重要 / 不可逆操作完成后，需用户确认已读

export const msgAlert = (
	message: string,
	title = '操作完成',
	type: MsgType = 'success',
) =>
	ElMessageBox.alert(message, title, {
		type,
		confirmButtonText: '知道了',
		modalClass: 'df-msgbox-on-top',
		customClass: 'df-msgbox-on-top',
	})
