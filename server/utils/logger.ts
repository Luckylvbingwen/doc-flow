import pino from 'pino'

const isDev = import.meta.dev

/** 根 logger 实例 */
const rootLogger = pino({
	level: isDev ? 'debug' : 'info',
	...(isDev
		? { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l' } } }
		: {}
	),
})

/**
 * 获取带模块标签的 child logger
 * @example const logger = useLogger('auth') → 日志中自动携带 { module: 'auth' }
 */
export function useLogger(module: string) {
	return rootLogger.child({ module })
}
