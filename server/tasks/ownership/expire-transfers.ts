/**
 * Nitro task: ownership:expire-transfers
 * 每天扫描过期的转移请求，自动关闭并通知发起人（PRD §6.3.10 第4节"长时间未响应"）
 *
 * 触发条件：status=1 且 expires_at < NOW()
 * 动作：status → 4(过期)，发 M11 给发起人，写 ownership.expire 日志
 */
import { prisma } from '~/server/utils/prisma'
import { createNotifications } from '~/server/utils/notify'
import { NOTIFICATION_TEMPLATES } from '~/server/constants/notification-templates'
import { LOG_ACTIONS } from '~/server/constants/log-actions'
import { writeLogs } from '~/server/utils/operation-log'

export default defineTask({
  meta: {
    name: 'ownership:expire-transfers',
    description: '扫描过期的归属人转移请求并自动关闭',
  },
  async run() {
    const now = new Date()

    // 查所有过期但仍 pending 的记录
    const expired = await prisma.doc_ownership_transfers.findMany({
      where: { status: 1, expires_at: { lt: now } },
      include: {
        doc_documents: { select: { id: true, title: true, group_id: true } },
      },
    })

    if (expired.length === 0) return { result: { expired: 0 } }

    // 批量更新状态
    const ids = expired.map(t => t.id)
    await prisma.doc_ownership_transfers.updateMany({
      where: { id: { in: ids } },
      data: { status: 4, processed_at: now },
    })

    // 批量通知发起人（M11 已过期）
    const notifications = expired.map(t =>
      NOTIFICATION_TEMPLATES.M11.build({
        toUserId: Number(t.from_user_id),
        fileName: t.doc_documents?.title ?? '未知文档',
        result: '已过期',
      }),
    )
    await createNotifications(notifications)

    // 操作日志（actor_user_id=0 系统触发）
    await writeLogs(
      expired.map(t => ({
        actorUserId: 0,
        action: LOG_ACTIONS.OWNERSHIP_EXPIRE,
        targetType: 'document' as const,
        targetId: Number(t.document_id),
        groupId: t.doc_documents?.group_id ? Number(t.doc_documents.group_id) : undefined,
        documentId: Number(t.document_id),
        detail: {
          desc: `归属人转移请求已过期（系统自动关闭）`,
          triggeredBy: 'system',
          fromUserId: Number(t.from_user_id),
          toUserId: Number(t.to_user_id),
        },
      })),
    )

    return { result: { expired: expired.length } }
  },
})
