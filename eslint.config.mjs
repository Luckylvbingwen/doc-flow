// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
	rules: {
		// 关闭与项目风格冲突的规则
		'vue/html-indent': 'off',
		'vue/multi-word-component-names': 'off',
		'@typescript-eslint/no-explicit-any': 'warn',
		'no-console': ['warn', { allow: ['warn', 'error'] }]
	}
})
