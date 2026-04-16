import { PrismaClient } from '@prisma/client'

const prismaClientSingleton = () => {
	return new PrismaClient({
		// 开发环境打印每条 SQL，方便调试
		log: process.env.NODE_ENV !== 'production' ? ['query'] : [],
	})
}

declare global {
	 
	var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>
}

export const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

if (import.meta.dev) {
	globalThis.prismaGlobal = prisma
}
