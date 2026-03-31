<template>
	<div class="df-file-meta" :class="{ 'df-file-meta--compact': compact }">
		<!-- 标题行 -->
		<div class="df-file-meta__head">
			<div class="df-file-icon" :class="`df-file-icon--${fileType}`">
				{{ typeAbbr }}
			</div>
			<div class="df-file-meta__title-wrap">
				<h4 class="df-file-meta__name">{{ fileName }}</h4>
				<div v-if="$slots.default" class="df-file-meta__badges">
					<slot />
				</div>
			</div>
			<div v-if="$slots.actions" class="df-file-meta__actions">
				<slot name="actions" />
			</div>
		</div>

		<!-- 属性行 -->
		<div v-if="metaItems.length" class="df-file-meta__props">
			<span v-for="(item, i) in metaItems" :key="i" class="df-file-meta__prop">
				<span class="df-file-meta__prop-label">{{ item.label }}</span>
				<span class="df-file-meta__prop-value" :class="{ 'df-file-meta__prop-value--highlight': item.highlight }">{{
					item.value }}</span>
			</span>
		</div>
	</div>
</template>

<script setup lang="ts">
export interface MetaItem {
	label: string
	value: string
	/** 主题色高亮 */
	highlight?: boolean
}

interface Props {
	/** 文件名 */
	fileName: string
	/** 文件类型 (docx / pdf / xlsx / md / txt / pptx) */
	fileType: string
	/** 属性列表 */
	metaItems?: MetaItem[]
	/** 紧凑模式（用于抽屉/卡片内嵌） */
	compact?: boolean
}

const props = withDefaults(defineProps<Props>(), {
	metaItems: () => [],
	compact: false,
})

/** 文件类型缩写映射 */
const TYPE_ABBR: Record<string, string> = {
	docx: 'W',
	doc: 'W',
	pdf: 'PDF',
	xlsx: 'X',
	xls: 'X',
	pptx: 'P',
	ppt: 'P',
	md: 'MD',
	txt: 'TXT',
}

const typeAbbr = computed(() => {
	const t = props.fileType?.toLowerCase() || ''
	return TYPE_ABBR[t] || t.slice(0, 3).toUpperCase() || '?'
})
</script>
