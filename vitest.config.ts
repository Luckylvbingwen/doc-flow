import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
	test: {
		environment: 'happy-dom',
		include: ['tests/**/*.test.ts'],
		coverage: {
			provider: 'v8',
			include: ['server/schemas/**', 'server/api/**', 'composables/**', 'utils/**', 'stores/**'],
			reporter: ['text', 'html'],
		},
	},
})
