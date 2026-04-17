import type { ApiResult, PaginatedData } from '~/types/api'
import type { LogItem } from '~/types/log'
import type { LogTypeCode } from '~/utils/log-types'

export interface LogListQuery {
	type?: LogTypeCode
	keyword?: string
	startAt?: string
	endAt?: string
	page?: number
	pageSize?: number
}

/** 操作日志列表（分页） */
export function apiGetLogs(params: LogListQuery = {}) {
	return useAuthFetch<ApiResult<PaginatedData<LogItem>>>('/api/logs', {
		method: 'GET',
		query: params,
	})
}
