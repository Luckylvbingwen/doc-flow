/**
 * 对象存储抽象接口（S3 兼容）
 *
 * 默认实现：MinIO（开发环境）
 * 生产：可切换为 AWS S3 / 阿里云 OSS 等 S3 兼容存储
 */
export interface ObjectStorage {
	/** 当前 bucket 名 */
	readonly bucket: string

	/** 上传对象 */
	putObject(
		key: string,
		body: Buffer,
		opts: { mimeType?: string, checksum?: string },
	): Promise<void>

	/** 下载对象为 Buffer（小文件使用） */
	getObject(key: string): Promise<Buffer>

	/** 下载对象为可读流（大文件下载） */
	getObjectStream(key: string): Promise<NodeJS.ReadableStream>

	/** 删除对象 */
	deleteObject(key: string): Promise<void>

	/** 生成预签名下载链接（默认 600 秒有效） */
	presignGetUrl(key: string, seconds?: number): Promise<string>
}
