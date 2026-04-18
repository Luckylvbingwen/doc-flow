// api/notifications.ts
import type { ApiResult } from '~/types/api'
import type { NotificationListQuery, NotificationListResp, UnreadCountResp, ReadAllBody } from '~/types/notification'

export function fetchNotifications(query: Partial<NotificationListQuery> = {}) {
	return useAuthFetch<ApiResult<NotificationListResp>>('/api/notifications', {
		method: 'GET',
		query,
	})
}

export function fetchUnreadCount() {
	return useAuthFetch<ApiResult<UnreadCountResp>>('/api/notifications/unread-count', {
		method: 'GET',
	})
}

export function markNotificationRead(id: string) {
	return useAuthFetch<ApiResult<Record<string, never>>>(`/api/notifications/${id}/read`, {
		method: 'PUT',
	})
}

export function markAllRead(body: ReadAllBody = {}) {
	return useAuthFetch<ApiResult<{ updated: number }>>('/api/notifications/read-all', {
		method: 'PUT',
		body,
	})
}
