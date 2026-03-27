import { useAppStore } from '~/stores/app'

export default defineNuxtPlugin(() => {
	const appStore = useAppStore()
	const { locale } = useI18n()

	appStore.hydrateLocale()
	locale.value = appStore.locale
})
