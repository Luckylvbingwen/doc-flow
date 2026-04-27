import { prisma } from '~/server/utils/prisma'

const logger = useLogger('prisma')

export default defineNitroPlugin(() => {
	// BigInt → JSON 安全序列化（Prisma raw query 返回 BIGINT 列为 JS bigint，
	// H3 JSON.stringify 不支持 bigint 会抛 "Do not know how to serialize a BigInt"）
	 
	; (BigInt.prototype as any).toJSON = function () {
		const n = Number(this)
		// 超出安全整数范围退化为字符串，避免精度丢失
		return Number.isSafeInteger(n) ? n : String(this)
	}

	// Initialize Prisma client on server startup.
	prisma.$connect().catch((error) => {
		logger.error({ err: error }, 'Prisma connection failed')
	})
})
