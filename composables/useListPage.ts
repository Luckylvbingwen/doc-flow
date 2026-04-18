/**
 * 列表页分页 + 加载状态 composable
 *
 * 职责（composable 拥有的）：
 *   - page / pageSize / list / total / loading 状态管理
 *   - fetchFn 执行编排：loading 切换、成功/失败分支、msgError 兜底
 *   - onFilterChange：筛选变化 → 重置 page=1 + 重新拉数
 *   - onPageChange：分页变化 → 重新拉数（不重置 page）
 *   - onResetFilter：调页面传入的 resetFilters 清筛选 → 重置 page=1 + 重新拉数
 *   - refresh：任意时机手动刷新（mutation 后常用）
 *   - Race condition 保护：并发请求只采纳最新响应
 *   - immediate：默认 onMounted 时自动首次加载，可关
 *
 * 职责边界（composable 不做的）：
 *   - 不持有页面的 filter ref（形状千变万化），由页面声明，在 buildQuery 里拼接
 *   - 不管 columns / slot / selection / 行级 loading 等页面级状态
 *   - 不做自动 watch filter 触发 refetch（项目约定：筛选元素手动 @change="onFilterChange"）
 *
 * 使用示例：
 *   const filterKeyword = ref('')
 *   const { page, pageSize, list, total, loading,
 *           refresh, onFilterChange, onResetFilter, onPageChange }
 *     = useListPage<LogItem, LogListQuery>({
 *       fetchFn: apiGetLogs,
 *       buildQuery: ({ page, pageSize }) => ({
 *         keyword: filterKeyword.value || undefined,
 *         page, pageSize,
 *       }),
 *       resetFilters: () => { filterKeyword.value = '' },
 *     })
 */
import type { Ref } from 'vue'
import type { ApiResult, PaginatedData } from '~/types/api'

export interface UseListPageOptions<T, Q> {
	/** 取数函数，返回统一 ApiResult<PaginatedData> */
	fetchFn: (query: Q) => Promise<ApiResult<PaginatedData<T>>>
	/** 从当前分页状态构造 query（页面在此注入自己的 filter ref） */
	buildQuery: (pagination: { page: number; pageSize: number }) => Q
	/** "清除筛选"按钮的回调 — 页面在此清自己的 filter ref */
	resetFilters?: () => void
	/** 首次挂载自动拉数，默认 true */
	immediate?: boolean
	/** 默认每页条数，默认 10 */
	defaultPageSize?: number
	/** 自定义错误处理；未提供时默认 msgError('加载失败') */
	onError?: (err: unknown) => void
}

export interface UseListPageReturn<T> {
	page: Ref<number>
	pageSize: Ref<number>
	list: Ref<T[]>
	total: Ref<number>
	loading: Ref<boolean>
	/** 手动刷新（保持当前 page / filter；mutation 后调用） */
	refresh: () => Promise<void>
	/** 筛选变化 → 重置到第一页 + 刷新 */
	onFilterChange: () => void
	/** 清除筛选按钮 → 调 resetFilters + 重置到第一页 + 刷新 */
	onResetFilter: () => void
	/** 分页变化 → 刷新（不重置 page） */
	onPageChange: () => void
}

export function useListPage<T, Q>(opts: UseListPageOptions<T, Q>): UseListPageReturn<T> {
	const page = ref(1)
	const pageSize = ref(opts.defaultPageSize ?? 10)
	const list = ref<T[]>([]) as Ref<T[]>
	const total = ref(0)
	const loading = ref(false)

	// Race condition 保护：自增序号，只采纳最新响应
	let requestSeq = 0

	async function refresh(): Promise<void> {
		const my = ++requestSeq
		loading.value = true
		try {
			const query = opts.buildQuery({ page: page.value, pageSize: pageSize.value })
			const res = await opts.fetchFn(query)
			if (my !== requestSeq) return // 被后续请求取代，丢弃本次响应
			if (res.success) {
				list.value = res.data.list
				total.value = res.data.total
			} else {
				msgError(res.message || '加载失败')
			}
		} catch (err) {
			if (my !== requestSeq) return
			if (opts.onError) opts.onError(err)
			else msgError('加载失败')
		} finally {
			// 只有最新请求才能清 loading，避免过时请求的 finally 提前关灯造成闪烁
			if (my === requestSeq) loading.value = false
		}
	}

	function onFilterChange(): void {
		page.value = 1
		refresh()
	}

	function onResetFilter(): void {
		opts.resetFilters?.()
		page.value = 1
		refresh()
	}

	function onPageChange(): void {
		refresh()
	}

	if (opts.immediate !== false) {
		onMounted(() => {
			refresh()
		})
	}

	return {
		page,
		pageSize,
		list,
		total,
		loading,
		refresh,
		onFilterChange,
		onResetFilter,
		onPageChange,
	}
}
