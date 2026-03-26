/**
 * 服务端 API 响应辅助函数
 * 确保所有接口返回统一 { success, code, message, data? } 结构
 */
import type { H3Event } from 'h3'

/** 成功响应 */
export function ok<T>(data: T, message = '操作成功') {
	return {
		success: true as const,
		code: 'OK' as const,
		message,
		data
	}
}

/** 失败响应 */
export function fail(event: H3Event, status: number, code: string, message: string) {
	setResponseStatus(event, status)
	return {
		success: false as const,
		code,
		message
	}
}
