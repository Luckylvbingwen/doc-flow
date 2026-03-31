import { versionListQuerySchema } from '~/server/schemas/version'

export default defineEventHandler(async (event) => {
	const documentId = Number(getRouterParam(event, 'id'))
	if (!documentId || isNaN(documentId)) {
		return fail(event, 400, 'INVALID_PARAM', '无效的文档 ID')
	}

	const query = await getValidatedQuery(event, versionListQuerySchema.parse)

	// TODO: 接入真实数据库查询
	// const versions = await prisma.doc_document_versions.findMany({
	//   where: { document_id: documentId, deleted_at: null },
	//   orderBy: { created_at: 'desc' },
	//   skip: (query.page - 1) * query.pageSize,
	//   take: query.pageSize,
	// })

	// Mock 数据 — 模拟文档版本列表
	const mockVersions = [
		{
			id: 1001,
			documentId,
			versionNo: 'v1.0',
			fileSize: 1_126_400,
			mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
			changeNote: '初始版本，包含项目背景和竞品概览',
			uploadedBy: 1,
			uploaderName: '周文静',
			publishedAt: new Date('2026-02-15 10:00').getTime(),
			createdAt: new Date('2026-02-15 10:00').getTime(),
			isCurrent: false,
			rollbackFrom: null,
		},
		{
			id: 1002,
			documentId,
			versionNo: 'v0.5',
			fileSize: 921_600,
			mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
			changeNote: '草稿版本，待补充章节',
			uploadedBy: 1,
			uploaderName: '周文静',
			publishedAt: new Date('2026-02-01 14:30').getTime(),
			createdAt: new Date('2026-02-01 14:30').getTime(),
			isCurrent: false,
			rollbackFrom: null,
		},
	]

	// 标记最新版本为当前版本
	if (mockVersions.length > 0) {
		mockVersions[0].isCurrent = true
	}

	return ok({
		list: mockVersions,
		total: mockVersions.length,
		page: query.page,
		pageSize: query.pageSize,
	})
})
