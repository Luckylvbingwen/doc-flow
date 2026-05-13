import type { ApiResult } from '~/types/api'

export interface SearchResult {
	groups: Array<{ id: number; name: string; description: string | null }>
	documents: Array<{ id: number; title: string; groupId: number; groupName: string; updatedAt: number }>
}

export function apiSearch(q: string) {
	return useAuthFetch<ApiResult<SearchResult>>('/api/search', { query: { q } })
}
