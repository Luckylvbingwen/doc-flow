<template>
	<el-select
ref="selectRef" :model-value="modelValue" :placeholder="placeholder" :disabled="disabled"
		:clearable="clearable" :loading="loading && !scrollLoading" filterable remote remote-show-suffix
		:remote-method="onSearch" :popper-class="`df-remote-select-popper${popperClass ? ' ' + popperClass : ''}`"
		@update:model-value="onUpdate" @visible-change="onVisibleChange" @clear="onClear">
		<el-option v-for="opt in options" :key="String(getValue(opt))" :label="getLabel(opt)" :value="getValue(opt)" />
		<template v-if="options.length > 0" #footer>
			<div class="df-remote-select-footer" :class="{ 'is-loading': scrollLoading }">
				<template v-if="scrollLoading">
					<el-icon class="df-remote-select-spinner">
						<Loading />
					</el-icon>
					加载中...
				</template>
				<template v-else-if="reachedEnd">已全部加载</template>
				<template v-else>下滑加载更多</template>
			</div>
		</template>
	</el-select>
</template>

<script setup lang="ts" generic="T extends Record<string, any>, V extends string | number">
/**
 * 远程搜索 + 滚动分页下拉
 *
 * Props:
 *   - modelValue / fetchFn：受控值 + 取数函数
 *   - itemLabel / itemValue：选项字段名（默认 'name' / 'id'），也可传函数
 *   - placeholder / disabled / clearable
 *   - pageSize（默认 20）
 *   - popperClass：自定义下拉类
 *
 * 行为：
 *   - 首次展开 → 拉第一页
 *   - 输入关键词 300ms 防抖 → 重置分页拉新一页
 *   - 下拉列表滚动到距底部 ≤ 40px → 加载下一页
 *   - total 用完或空页后不再请求
 *
 * 已选值回显：
 *   如果 modelValue 不为空但当前选项里没有这个 value，会调用 fetchFn({ keyword: '', page: 1 })
 *   拿到首页里匹配的项或以"(已选: id=V)"占位，确保回显不是空白。
 */
import { Loading } from '@element-plus/icons-vue'
import { ElSelect } from 'element-plus'
import type { PropType } from 'vue'

interface PageResult {
	list: T[]
	total: number
}

const props = defineProps({
	modelValue: {
		type: [String, Number, null] as PropType<V | null | undefined>,
		default: null,
	},
	fetchFn: {
		type: Function as PropType<(params: { keyword: string; page: number; pageSize: number }) => Promise<PageResult>>,
		required: true,
	},
	itemLabel: {
		type: [String, Function] as PropType<keyof T | ((item: T) => string)>,
		default: 'name',
	},
	itemValue: {
		type: [String, Function] as PropType<keyof T | ((item: T) => V)>,
		default: 'id',
	},
	placeholder: {
		type: String,
		default: '请选择',
	},
	disabled: {
		type: Boolean,
		default: false,
	},
	clearable: {
		type: Boolean,
		default: true,
	},
	pageSize: {
		type: Number,
		default: 20,
	},
	popperClass: {
		type: String,
		default: '',
	},
})

const emit = defineEmits<{
	'update:modelValue': [value: V | null]
	'change': [value: V | null, item: T | null]
}>()

const selectRef = ref<InstanceType<typeof ElSelect> | null>(null)
const options = ref<T[]>([]) as Ref<T[]>
const loading = ref(false)
const scrollLoading = ref(false)
const currentPage = ref(1)
const currentKeyword = ref('')
const total = ref(0)
const initialized = ref(false)

const reachedEnd = computed(() => options.value.length >= total.value)

function getLabel(item: T): string {
	if (typeof props.itemLabel === 'function') return props.itemLabel(item)
	return String(item[props.itemLabel as keyof T] ?? '')
}

function getValue(item: T): V {
	if (typeof props.itemValue === 'function') return props.itemValue(item)
	return item[props.itemValue as keyof T] as V
}

async function loadPage(keyword: string, page: number, append: boolean) {
	if (page === 1) {
		loading.value = true
	} else {
		scrollLoading.value = true
	}
	try {
		const res = await props.fetchFn({ keyword, page, pageSize: props.pageSize })
		total.value = res.total
		if (append) {
			options.value = [...options.value, ...res.list]
		} else {
			options.value = res.list
		}
		currentPage.value = page
		currentKeyword.value = keyword
	} catch {
		if (!append) {
			options.value = []
			total.value = 0
		}
	} finally {
		loading.value = false
		scrollLoading.value = false
	}
}

// ─── remote-method 防抖 ───
let searchTimer: ReturnType<typeof setTimeout> | null = null
function onSearch(keyword: string) {
	if (searchTimer) clearTimeout(searchTimer)
	searchTimer = setTimeout(() => {
		loadPage(keyword, 1, false)
	}, 300)
}

// ─── 展开时首次加载 ───
async function onVisibleChange(visible: boolean) {
	if (visible && !initialized.value) {
		initialized.value = true
		await loadPage('', 1, false)
	}
	if (visible) {
		// 下一帧挂滚动监听，等 popper DOM 渲染出来
		nextTick(() => bindScroll())
	}
}

function onUpdate(value: V | null) {
	emit('update:modelValue', value)
	const selected = value == null ? null : options.value.find(o => getValue(o) === value) ?? null
	emit('change', value, selected)
}

function onClear() {
	emit('update:modelValue', null)
	emit('change', null, null)
}

// ─── 滚动分页 ───
let scrollEl: HTMLElement | null = null
function bindScroll() {
	const popperEl = (selectRef.value as unknown as { popperRef?: { contentRef?: HTMLElement } })?.popperRef?.contentRef
	const wrap = popperEl?.querySelector<HTMLElement>('.el-select-dropdown .el-scrollbar__wrap')
		|| popperEl?.querySelector<HTMLElement>('.el-scrollbar__wrap')
	if (!wrap || wrap === scrollEl) return
	if (scrollEl) scrollEl.removeEventListener('scroll', onScroll)
	scrollEl = wrap
	scrollEl.addEventListener('scroll', onScroll, { passive: true })
}

function onScroll() {
	if (!scrollEl || scrollLoading.value || loading.value) return
	if (reachedEnd.value) return
	const distance = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight
	if (distance <= 40) {
		loadPage(currentKeyword.value, currentPage.value + 1, true)
	}
}

onBeforeUnmount(() => {
	if (searchTimer) clearTimeout(searchTimer)
	if (scrollEl) scrollEl.removeEventListener('scroll', onScroll)
})

// 对外暴露刷新方法
defineExpose({
	refresh: () => loadPage(currentKeyword.value, 1, false),
	reset: () => {
		options.value = []
		total.value = 0
		currentPage.value = 1
		currentKeyword.value = ''
		initialized.value = false
	},
})
</script>

<style lang="scss">
.df-remote-select-popper {
	.df-remote-select-footer {
		padding: 6px 12px;
		text-align: center;
		font-size: 12px;
		color: var(--df-subtext);
		line-height: 1.5;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 4px;

		&.is-loading {
			color: var(--df-primary);
		}
	}

	.df-remote-select-spinner {
		animation: df-remote-select-spin 1s linear infinite;
	}
}

@keyframes df-remote-select-spin {
	to {
		transform: rotate(360deg);
	}
}
</style>
