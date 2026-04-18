// types/notification.ts
import type { NotificationListQuery, ReadAllBody } from '~/server/schemas/notification'
import type {
	NotificationCategory, NotificationBizType,
	NotificationItem, NotificationListResp, UnreadCountResp,
} from '~/server/types/notification'

export type {
	NotificationCategory, NotificationBizType,
	NotificationItem, NotificationListResp, UnreadCountResp,
	NotificationListQuery, ReadAllBody,
}
