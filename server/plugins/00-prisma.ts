import { prisma } from '~/server/utils/prisma'

const logger = useLogger('prisma')

export default defineNitroPlugin(() => {
	// Initialize Prisma client on server startup.
	prisma.$connect().catch((error) => {
		logger.error({ err: error }, 'Prisma connection failed')
	})
})
