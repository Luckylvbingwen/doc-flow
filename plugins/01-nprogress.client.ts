import NProgress from 'nprogress'
import 'nprogress/nprogress.css'

export default defineNuxtPlugin((nuxtApp) => {
	const router = useRouter()

	NProgress.configure({
		showSpinner: false,
		trickleSpeed: 120,
		minimum: 0.12
	})

	router.beforeEach(() => {
		NProgress.start()
	})

	router.afterEach(() => {
		NProgress.done()
	})

	nuxtApp.hook('page:start', () => {
		NProgress.start()
	})

	nuxtApp.hook('page:finish', () => {
		NProgress.done()
	})

	nuxtApp.hook('app:error', () => {
		NProgress.done()
	})

	nuxtApp.hook('vue:error', () => {
		NProgress.done()
	})
})
