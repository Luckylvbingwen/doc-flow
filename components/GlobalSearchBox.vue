<template>
	<div ref="containerRef" class="global-search">
		<el-input
v-model="keyword" placeholder="搜索文档名或组名..." clearable :prefix-icon="Search" @input="onInput"
			@focus="showDropdown = true" @clear="clearResults" @keydown.escape="close" />
		<div
v-if="showDropdown && keyword.trim() && (loading || groups.length > 0 || documents.length > 0)"
			class="global-search__dropdown">
			<div v-if="loading" class="global-search__status">搜索中...</div>
			<div v-else-if="groups.length === 0 && documents.length === 0" class="global-search__status">
				未找到相关内容
			</div>
			<template v-else>
				<div v-if="groups.length > 0" class="global-search__section">
					<div class="global-search__section-title">组</div>
					<div v-for="g in groups" :key="g.id" class="global-search__item" @mousedown.prevent="onGroupClick(g)">
						<el-icon class="global-search__item-icon">
							<Collection />
						</el-icon>
						<span>{{ g.name }}</span>
					</div>
				</div>
				<div v-if="documents.length > 0" class="global-search__section">
					<div class="global-search__section-title">文档</div>
					<div v-for="d in documents" :key="d.id" class="global-search__item" @mousedown.prevent="onDocClick(d)">
						<el-icon class="global-search__item-icon">
							<Document />
						</el-icon>
						<div class="global-search__item-info">
							<span class="global-search__item-title">{{ d.title }}</span>
							<span class="global-search__item-meta">{{ d.groupName }}</span>
						</div>
					</div>
				</div>
			</template>
		</div>
	</div>
</template>

<script setup lang="ts">
import { Search, Collection, Document } from '@element-plus/icons-vue'
import { apiSearch } from '~/api/search'
import type { SearchResult } from '~/api/search'

const emit = defineEmits<{
	'group-select': [id: number]
}>()

const router = useRouter()
const keyword = ref('')
const loading = ref(false)
const showDropdown = ref(false)
const groups = ref<SearchResult['groups']>([])
const documents = ref<SearchResult['documents']>([])
const containerRef = ref<HTMLElement>()

let debounceTimer: ReturnType<typeof setTimeout>

onMounted(() => document.addEventListener('mousedown', handleOutside))
onUnmounted(() => document.removeEventListener('mousedown', handleOutside))

function handleOutside(e: MouseEvent) {
	if (containerRef.value && !containerRef.value.contains(e.target as Node)) {
		showDropdown.value = false
	}
}

function close() {
	showDropdown.value = false
}

function clearResults() {
	groups.value = []
	documents.value = []
	showDropdown.value = false
}

async function doSearch(q: string) {
	loading.value = true
	try {
		const res = await apiSearch(q)
		if (res.success) {
			groups.value = res.data.groups
			documents.value = res.data.documents
		}
	} finally {
		loading.value = false
	}
}

function onInput(val: string) {
	clearTimeout(debounceTimer)
	showDropdown.value = true
	if (!val.trim()) {
		groups.value = []
		documents.value = []
		loading.value = false
		return
	}
	debounceTimer = setTimeout(() => doSearch(val.trim()), 300)
}

function onGroupClick(g: SearchResult['groups'][0]) {
	emit('group-select', g.id)
	keyword.value = ''
	close()
}

function onDocClick(d: SearchResult['documents'][0]) {
	router.push(`/docs/file/${d.id}`)
	keyword.value = ''
	close()
}
</script>

<style lang="scss" scoped>
.global-search {
	position: relative;
	width: 280px;
	flex-shrink: 0;
}

.global-search__dropdown {
	position: absolute;
	top: calc(100% + 4px);
	left: 0;
	right: 0;
	background: var(--df-panel);
	border: 1px solid var(--df-border);
	border-radius: 8px;
	box-shadow: 0 8px 24px rgb(0 0 0 / 10%);
	z-index: 1000;
	overflow: hidden;
	max-height: 400px;
	overflow-y: auto;
}

.global-search__status {
	padding: 12px 16px;
	font-size: 13px;
	color: var(--df-subtext);
	text-align: center;
}

.global-search__section {
	&+& {
		border-top: 1px solid var(--df-border);
	}
}

.global-search__section-title {
	padding: 8px 16px 4px;
	font-size: 11px;
	font-weight: 600;
	color: var(--df-subtext);
	letter-spacing: 0.05em;
	text-transform: uppercase;
}

.global-search__item {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 8px 16px;
	cursor: pointer;
	transition: background 0.15s;

	&:hover {
		background: var(--df-surface);
	}
}

.global-search__item-icon {
	color: var(--df-subtext);
	flex-shrink: 0;
}

.global-search__item-info {
	display: flex;
	flex-direction: column;
	gap: 1px;
	min-width: 0;
}

.global-search__item-title {
	font-size: 13px;
	color: var(--df-text);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.global-search__item-meta {
	font-size: 11px;
	color: var(--df-subtext);
}
</style>
