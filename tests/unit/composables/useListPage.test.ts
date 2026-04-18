// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import type { ApiResult, PaginatedData } from '~/types/api'

import { useListPage, type UseListPageOptions } from '~/composables/useListPage'

// Mock 全局 msgError：useListPage 通过 Nuxt auto-import 调用 msgError，
// auto-import 在编译期把标识符绑到 composables/useNotify 模块导出，故需 vi.mock 该模块
const msgErrorMock = vi.fn()
vi.mock('~/composables/useNotify', () => ({
	msgError: (msg: string) => msgErrorMock(msg),
	msgSuccess: vi.fn(),
	msgInfo: vi.fn(),
	msgWarning: vi.fn(),
	msgConfirm: vi.fn(),
	msgAlert: vi.fn(),
	msgErrorDetail: vi.fn(),
	msgNotify: vi.fn(),
}))
// 同时 stubGlobal 兜底：若编译期 auto-import 未介入，运行时全局 msgError 也生效
vi.stubGlobal('msgError', (msg: string) => msgErrorMock(msg))

interface Item { id: number; name: string }
type Query = { page: number; pageSize: number; keyword?: string }

/** 用一个最小组件挂载，提供 setup 上下文给 composable */
function withSetup<T>(setupFn: () => T) {
	let result!: T
	const Comp = defineComponent({
		setup() {
			result = setupFn()
			return () => h('div')
		},
	})
	const wrapper = mount(Comp)
	return { result, wrapper }
}

function ok<T>(data: T): ApiResult<T> {
	return { success: true, code: 'OK', message: 'OK', data }
}
function err(message = 'boom', code = 'E_FAIL'): ApiResult<never> {
	return { success: false, code, message }
}
function page<T>(list: T[], total: number, pageNo: number, size: number): PaginatedData<T> {
	return { list, total, page: pageNo, pageSize: size }
}

beforeEach(() => {
	msgErrorMock.mockClear()
})

describe('useListPage', () => {
	it('初始状态：page=1, pageSize=10（默认）, list=[], total=0, loading=false', () => {
		const fetchFn = vi.fn().mockResolvedValue(ok(page([] as Item[], 0, 1, 10)))
		const { result } = withSetup(() =>
			useListPage<Item, Query>({
				fetchFn,
				buildQuery: ({ page, pageSize }) => ({ page, pageSize }),
				immediate: false,
			}),
		)
		expect(result.page.value).toBe(1)
		expect(result.pageSize.value).toBe(10)
		expect(result.list.value).toEqual([])
		expect(result.total.value).toBe(0)
		expect(result.loading.value).toBe(false)
	})

	it('defaultPageSize 覆盖默认值', () => {
		const fetchFn = vi.fn().mockResolvedValue(ok(page([] as Item[], 0, 1, 20)))
		const { result } = withSetup(() =>
			useListPage<Item, Query>({
				fetchFn,
				buildQuery: ({ page, pageSize }) => ({ page, pageSize }),
				immediate: false,
				defaultPageSize: 20,
			}),
		)
		expect(result.pageSize.value).toBe(20)
	})

	it('immediate=true（默认）：挂载后自动 fetch', async () => {
		const fetchFn = vi.fn().mockResolvedValue(
			ok(page([{ id: 1, name: 'a' }], 1, 1, 10)),
		)
		const { result } = withSetup(() =>
			useListPage<Item, Query>({
				fetchFn,
				buildQuery: ({ page, pageSize }) => ({ page, pageSize }),
			}),
		)
		// onMounted 是异步的，等一轮
		await nextTick()
		await Promise.resolve()
		expect(fetchFn).toHaveBeenCalledTimes(1)
		expect(result.list.value).toEqual([{ id: 1, name: 'a' }])
		expect(result.total.value).toBe(1)
	})

	it('immediate=false：挂载后不自动 fetch', async () => {
		const fetchFn = vi.fn()
		withSetup(() =>
			useListPage<Item, Query>({
				fetchFn,
				buildQuery: ({ page, pageSize }) => ({ page, pageSize }),
				immediate: false,
			}),
		)
		await nextTick()
		expect(fetchFn).not.toHaveBeenCalled()
	})

	it('refresh 成功：更新 list 和 total，清 loading', async () => {
		const fetchFn = vi.fn().mockResolvedValue(
			ok(page([{ id: 2, name: 'b' }, { id: 3, name: 'c' }], 2, 1, 10)),
		)
		const { result } = withSetup(() =>
			useListPage<Item, Query>({
				fetchFn,
				buildQuery: ({ page, pageSize }) => ({ page, pageSize }),
				immediate: false,
			}),
		)
		await result.refresh()
		expect(result.list.value).toHaveLength(2)
		expect(result.total.value).toBe(2)
		expect(result.loading.value).toBe(false)
	})

	it('refresh 业务失败（success:false）：msgError 用后端 message', async () => {
		const fetchFn = vi.fn().mockResolvedValue(err('后端错'))
		const { result } = withSetup(() =>
			useListPage<Item, Query>({
				fetchFn,
				buildQuery: ({ page, pageSize }) => ({ page, pageSize }),
				immediate: false,
			}),
		)
		await result.refresh()
		expect(msgErrorMock).toHaveBeenCalledWith('后端错')
	})

	it('refresh 抛异常：默认 msgError("加载失败")', async () => {
		const fetchFn = vi.fn().mockRejectedValue(new Error('network'))
		const { result } = withSetup(() =>
			useListPage<Item, Query>({
				fetchFn,
				buildQuery: ({ page, pageSize }) => ({ page, pageSize }),
				immediate: false,
			}),
		)
		await result.refresh()
		expect(msgErrorMock).toHaveBeenCalledWith('加载失败')
	})

	it('onError 自定义：覆盖默认异常处理', async () => {
		const fetchFn = vi.fn().mockRejectedValue(new Error('network'))
		const onError = vi.fn()
		const { result } = withSetup(() =>
			useListPage<Item, Query>({
				fetchFn,
				buildQuery: ({ page, pageSize }) => ({ page, pageSize }),
				immediate: false,
				onError,
			}),
		)
		await result.refresh()
		expect(onError).toHaveBeenCalledTimes(1)
		expect(msgErrorMock).not.toHaveBeenCalled()
	})

	it('onFilterChange：重置 page=1 + refetch', async () => {
		const fetchFn = vi.fn().mockResolvedValue(ok(page([] as Item[], 0, 1, 10)))
		const { result } = withSetup(() =>
			useListPage<Item, Query>({
				fetchFn,
				buildQuery: ({ page, pageSize }) => ({ page, pageSize }),
				immediate: false,
			}),
		)
		result.page.value = 5
		result.onFilterChange()
		await nextTick()
		await Promise.resolve()
		expect(result.page.value).toBe(1)
		expect(fetchFn).toHaveBeenCalledTimes(1)
	})

	it('onPageChange：保持 page + refetch', async () => {
		const fetchFn = vi.fn().mockResolvedValue(ok(page([] as Item[], 0, 3, 10)))
		const { result } = withSetup(() =>
			useListPage<Item, Query>({
				fetchFn,
				buildQuery: ({ page, pageSize }) => ({ page, pageSize }),
				immediate: false,
			}),
		)
		result.page.value = 3
		result.onPageChange()
		await nextTick()
		await Promise.resolve()
		expect(result.page.value).toBe(3) // 不重置
		expect(fetchFn).toHaveBeenCalledTimes(1)
	})

	it('onResetFilter：调 resetFilters 回调 + 重置 page + refetch', async () => {
		const fetchFn = vi.fn().mockResolvedValue(ok(page([] as Item[], 0, 1, 10)))
		const resetFilters = vi.fn()
		const { result } = withSetup(() =>
			useListPage<Item, Query>({
				fetchFn,
				buildQuery: ({ page, pageSize }) => ({ page, pageSize }),
				resetFilters,
				immediate: false,
			}),
		)
		result.page.value = 4
		result.onResetFilter()
		await nextTick()
		await Promise.resolve()
		expect(resetFilters).toHaveBeenCalledTimes(1)
		expect(result.page.value).toBe(1)
		expect(fetchFn).toHaveBeenCalledTimes(1)
	})

	it('buildQuery 能拿到当前 page/pageSize', async () => {
		const fetchFn = vi.fn().mockResolvedValue(ok(page([] as Item[], 0, 2, 15)))
		const buildQuery = vi.fn((p) => ({ ...p, keyword: 'x' }))
		const { result } = withSetup(() =>
			useListPage<Item, Query>({
				fetchFn,
				buildQuery: buildQuery as UseListPageOptions<Item, Query>['buildQuery'],
				immediate: false,
			}),
		)
		result.page.value = 2
		result.pageSize.value = 15
		await result.refresh()
		expect(buildQuery).toHaveBeenCalledWith({ page: 2, pageSize: 15 })
		expect(fetchFn).toHaveBeenCalledWith({ page: 2, pageSize: 15, keyword: 'x' })
	})

	it('Race condition：并发下只采纳最后一次响应', async () => {
		// 两个请求依次发出，但响应顺序反过来（慢的先入 pending，快的后到达）
		let resolveFirst!: (v: ApiResult<PaginatedData<Item>>) => void
		let resolveSecond!: (v: ApiResult<PaginatedData<Item>>) => void
		const fetchFn = vi.fn()
			.mockImplementationOnce(() => new Promise((r) => { resolveFirst = r }))
			.mockImplementationOnce(() => new Promise((r) => { resolveSecond = r }))

		const { result } = withSetup(() =>
			useListPage<Item, Query>({
				fetchFn,
				buildQuery: ({ page, pageSize }) => ({ page, pageSize }),
				immediate: false,
			}),
		)

		const p1 = result.refresh()
		const p2 = result.refresh()
		// 第二个请求先返回，设置了 list=[B]
		resolveSecond(ok(page([{ id: 2, name: 'B' }], 1, 1, 10)))
		await p2
		expect(result.list.value).toEqual([{ id: 2, name: 'B' }])
		expect(result.loading.value).toBe(false)
		// 第一个请求后返回（过时响应），list 不应被覆盖
		resolveFirst(ok(page([{ id: 1, name: 'A' }], 1, 1, 10)))
		await p1
		expect(result.list.value).toEqual([{ id: 2, name: 'B' }])
	})

	it('loading：请求期间为 true，结束后为 false', async () => {
		let resolver!: (v: ApiResult<PaginatedData<Item>>) => void
		const fetchFn = vi.fn(() => new Promise<ApiResult<PaginatedData<Item>>>((r) => { resolver = r }))
		const { result } = withSetup(() =>
			useListPage<Item, Query>({
				fetchFn,
				buildQuery: ({ page, pageSize }) => ({ page, pageSize }),
				immediate: false,
			}),
		)
		const p = result.refresh()
		expect(result.loading.value).toBe(true)
		resolver(ok(page([] as Item[], 0, 1, 10)))
		await p
		expect(result.loading.value).toBe(false)
	})
})
