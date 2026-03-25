import { prisma } from '../utils/prisma'

export default defineNitroPlugin(() => {
	// Initialize Prisma client on server startup.
	prisma.$connect().catch((error) => {
		console.error('Prisma connection failed:', error)
	})
})
