/**
 * 未读数对账（WS 断开重连时 + 登录完成时各拉一次）
 * 正常会话无定时轮询，仅靠 WS 推送更新 wsStore.badges.notifications
 */
import { fetchUnreadCount } from '~/api/notifications'

let reconciling = false

export async function reconcileNotificationBadge() {
	if (reconciling) return
	reconciling = true
	try {
		const wsStore = useWsStore()
		const res = await fetchUnreadCount()
		if (res.success) {
			wsStore.badges.notifications = res.data.total
		}
	} catch {
		// 静默；下次对账点会再次尝试
	} finally {
		reconciling = false
	}
}
