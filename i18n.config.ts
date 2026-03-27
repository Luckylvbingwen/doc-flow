import zhCN from './i18n/locales/zh-CN'
import enUS from './i18n/locales/en-US'

export default defineI18nConfig(() => ({
	legacy: false,
	locale: 'zh-CN',
	fallbackLocale: 'zh-CN',
	messages: {
		'zh-CN': zhCN,
		'en-US': enUS,
	},
}))
