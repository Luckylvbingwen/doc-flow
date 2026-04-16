/**
 * 轻量级雪花 ID 生成器
 * doc_* 表主键为 BIGINT UNSIGNED（无 AUTO_INCREMENT），需要应用层生成 ID
 *
 * 结构: 41-bit 时间戳(ms) + 12-bit 序列号 = 53 bit
 * 可安全表示为 JS Number（Number.MAX_SAFE_INTEGER = 2^53 - 1）
 * 自定义纪元: 2026-01-01 00:00:00 UTC，可用约 69 年
 */

const EPOCH = 1767225600000n // 2026-01-01T00:00:00Z
const SEQUENCE_BITS = 12n
const SEQUENCE_MASK = (1n << SEQUENCE_BITS) - 1n // 0xFFF

let lastTimestamp = 0n
let sequence = 0n

export function generateId(): bigint {
	let ts = BigInt(Date.now()) - EPOCH

	if (ts === lastTimestamp) {
		sequence = (sequence + 1n) & SEQUENCE_MASK
		// 同一毫秒内序列溢出，等待下一毫秒
		if (sequence === 0n) {
			while (ts <= lastTimestamp) {
				ts = BigInt(Date.now()) - EPOCH
			}
		}
	} else {
		sequence = 0n
	}

	lastTimestamp = ts
	return (ts << SEQUENCE_BITS) | sequence
}
