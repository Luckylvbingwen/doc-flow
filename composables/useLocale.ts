import { useAppStore } from '~/stores/app'

/**
 * 语言切换 composable
 * 读写 appStore.locale 并同步 vue-i18n，持久化到 localStorage
 */
export function useLocale() {
	const { locale } = useI18n()
	const appStore = useAppStore()

	const currentLocale = computed(() => appStore.locale)

	function setLocale(code: 'zh-CN' | 'en-US') {
		appStore.setLocale(code)
		locale.value = code
	}

	function toggleLocale() {
		setLocale(currentLocale.value === 'zh-CN' ? 'en-US' : 'zh-CN')
	}

	return { currentLocale, setLocale, toggleLocale }
}
