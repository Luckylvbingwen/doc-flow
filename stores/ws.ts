import { defineStore } from 'pinia'
import type { WsBadgePayload } from '~/types/ws'

export const useWsStore = defineStore('ws', {
	state: () => ({
		/** 连接状态 */
		connected: false,
		/** 菜单 badge 数据 */
		badges: {
			notifications: 0,
			approvals: 0
		} as Required<WsBadgePayload>
	}),
	actions: {
		setConnected(value: boolean) {
			this.connected = value
		},
		updateBadges(payload: WsBadgePayload) {
			if (payload.notifications !== undefined) this.badges.notifications = payload.notifications
			if (payload.approvals !== undefined) this.badges.approvals = payload.approvals
		},
		resetBadges() {
			this.badges.notifications = 0
			this.badges.approvals = 0
		}
	}
})
