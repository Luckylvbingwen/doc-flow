/**
 * Hocuspocus 协同服务管理工具
 * 用于从主应用通知 hocuspocus 关闭/管理协同房间
 */

const config = useRuntimeConfig()

function getMgmtUrl(): string {
	// Docker 内部网络通过服务名访问；本地开发走 localhost
	const host = process.env.HOCUSPOCUS_MGMT_HOST ?? 'hocuspocus'
	const port = process.env.HOCUSPOCUS_MGMT_PORT ?? '1235'
	return `http://${host}:${port}`
}

function getInternalSecret(): string {
	return process.env.HOCUSPOCUS_INTERNAL_SECRET ?? config.jwtSecret ?? ''
}

/**
 * 关闭指定文档的协同编辑房间
 * 触发场景：文档发布成功、草稿删除、从组移除
 *
 * @param documentId 文档 ID
 * @param reason 关闭原因（日志用）
 * @returns 关闭的连接数，失败返回 -1（不阻塞主流程）
 */
export async function closeCollabRoom(documentId: number | bigint, reason: string): Promise<number> {
	const documentName = `doc-${documentId}`
	try {
		const resp = await $fetch<{ success: boolean; closedCount: number }>(`${getMgmtUrl()}/close-room`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Internal-Secret': getInternalSecret(),
			},
			body: { documentName, reason },
			timeout: 3000,
		})
		return resp.closedCount
	} catch (err) {
		// 不阻塞主业务流程，仅记录警告
		console.warn(`[hocuspocus] 关闭房间 ${documentName} 失败:`, (err as Error).message)
		return -1
	}
}
