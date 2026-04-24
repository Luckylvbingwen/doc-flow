import type {
	S3Client
} from '@aws-sdk/client-s3';
import {
	PutObjectCommand,
	GetObjectCommand,
	DeleteObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { ObjectStorage } from './types'

/**
 * MinIO 实现（S3 协议兼容）
 *
 * 注意：MinIO 必须使用 forcePathStyle=true（在 index.ts 初始化 S3Client 时设置）
 */
export class MinioStorage implements ObjectStorage {
	constructor(
		private client: S3Client,
		readonly bucket: string,
	) { }

	async putObject(
		key: string,
		body: Buffer,
		opts: { mimeType?: string, checksum?: string },
	): Promise<void> {
		await this.client.send(
			new PutObjectCommand({
				Bucket: this.bucket,
				Key: key,
				Body: body,
				ContentType: opts.mimeType,
				// MinIO 会根据 Content-MD5 或 x-amz-checksum-sha256 校验；这里不设置，由调用方自行在业务层校验
			}),
		)
	}

	async getObject(key: string): Promise<Buffer> {
		const res = await this.client.send(
			new GetObjectCommand({ Bucket: this.bucket, Key: key }),
		)
		const chunks: Buffer[] = []
		for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
			chunks.push(Buffer.from(chunk))
		}
		return Buffer.concat(chunks)
	}

	async getObjectStream(key: string): Promise<NodeJS.ReadableStream> {
		const res = await this.client.send(
			new GetObjectCommand({ Bucket: this.bucket, Key: key }),
		)
		return res.Body as NodeJS.ReadableStream
	}

	async deleteObject(key: string): Promise<void> {
		await this.client.send(
			new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
		)
	}

	async presignGetUrl(key: string, seconds = 600): Promise<string> {
		return getSignedUrl(
			this.client,
			new GetObjectCommand({ Bucket: this.bucket, Key: key }),
			{ expiresIn: seconds },
		)
	}
}
