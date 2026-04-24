import type { ObjectStorage } from './types'

/**
 * 懒初始化 S3 客户端
 *
 * 必须懒加载的原因：
 *   - @aws-sdk/client-s3 的顶层 import 会触发 AWS SDK 内部复杂的模块解析链
 *   - 在 Windows + Node 20+ ESM 下，其中某些 sub-package 的路径解析会抛
 *     "Only URLs with a scheme in: file, data, and node are supported" 错误
 *   - 顶层初始化会导致任何 server handler 的模块加载都失败（即便该 handler 不用存储）
 *   - 懒加载把 SDK 初始化推迟到首个实际上传/下载请求时，不影响无关页面 SSR
 */
let _storage: ObjectStorage | null = null

async function createStorage(): Promise<ObjectStorage> {
	// 动态 import 也延后到此刻再触发（S3Client 与 MinioStorage 都不在 server bundle 顶层）
	const { S3Client } = await import('@aws-sdk/client-s3')
	const { MinioStorage } = await import('./minio')
	const client = new S3Client({
		endpoint: process.env.STORAGE_ENDPOINT,
		region: process.env.STORAGE_REGION || 'us-east-1',
		credentials: {
			accessKeyId: process.env.STORAGE_ACCESS_KEY!,
			secretAccessKey: process.env.STORAGE_SECRET_KEY!,
		},
		forcePathStyle: true, // MinIO 必须
	})
	return new MinioStorage(client, process.env.STORAGE_BUCKET!)
}

/**
 * 通过 Proxy 暴露 ObjectStorage 接口，首次访问任意方法时才实例化 S3Client
 *
 * 业务代码使用方式不变：`storage.putObject(...)` / `storage.bucket`
 */
export const storage: ObjectStorage = new Proxy({} as ObjectStorage, {
	get(_target, prop: keyof ObjectStorage) {
		if (prop === 'bucket') {
			return process.env.STORAGE_BUCKET ?? ''
		}
		// 方法：返回一个 async 代理，首次调用时拉起真实 storage
		return async (...args: unknown[]) => {
			if (!_storage) _storage = await createStorage()
			const fn = (_storage as unknown as Record<string, (...a: unknown[]) => unknown>)[prop as string]
			return fn.apply(_storage, args)
		}
	},
})

/**
 * 生成 storage_key
 *
 * 规则：{groupId|drafts}/{documentId}/{versionNo}-{shortHash}.{ext}
 * 例：40002/50002/v1.0-a3f7b1d2.md
 */
export function buildStorageKey(params: {
	groupId: bigint | number | null
	documentId: bigint | number
	versionNo: string
	checksum: string
	ext: string
}): string {
	const prefix = params.groupId ? String(params.groupId) : 'drafts'
	const shortHash = params.checksum.slice(0, 8)
	return `${prefix}/${params.documentId}/${params.versionNo}-${shortHash}.${params.ext}`
}
