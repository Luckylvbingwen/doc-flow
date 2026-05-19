import type { ApiResult } from '~/types/api'

export interface SearchResult {
	groups: Array<{ id: number; name: string; description: string | null; scopeType: number }>
	documents: Array<{ id: number; title: string; groupId: number; groupName: string; updatedAt: number; versionNo: string | null }>
}

export function apiSearch(q: string) {
	return useAuthFetch<ApiResult<SearchResult>>('/api/search', { query: { q } })
}
