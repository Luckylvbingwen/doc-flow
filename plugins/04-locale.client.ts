import { useAppStore } from '~/stores/app'

export default defineNuxtPlugin((nuxtApp) => {
	const appStore = useAppStore()
	const i18n = nuxtApp.$i18n as { locale: { value: string } }

	appStore.hydrateLocale()
	i18n.locale.value = appStore.locale
})
