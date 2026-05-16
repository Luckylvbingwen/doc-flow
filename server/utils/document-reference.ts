import { prisma } from '~/server/utils/prisma'
import { createNotifications } from '~/server/utils/notify'
import { NOTIFICATION_TEMPLATES } from '~/server/constants/notification-templates'

/**
 * 清理某个源文档的所有引用关系，并通知各目标组管理员（M26）
 *
 * 触发场景：
 * - 源文档被管理员从组移除
 * - 源文档被归属人删除
 */
export async function cleanupDocumentReferences(sourceDocumentId: bigint | number): Promise<number> {
  const docId = BigInt(sourceDocumentId)

  // 查所有引用关系 + 目标组管理员（role=1 + 组负责人）
  const refs = await prisma.doc_document_references.findMany({
    where: { source_document_id: docId },
    include: {
      doc_documents: { select: { title: true } },
      doc_groups_doc_document_references_source_group_idTodoc_groups: {
        select: { name: true },
      },
      doc_groups_doc_document_references_target_group_idTodoc_groups: {
        select: { id: true, name: true, owner_user_id: true },
      },
    },
  })

  if (refs.length === 0) return 0

  const notifications: Array<ReturnType<typeof NOTIFICATION_TEMPLATES.M26.build>> = []

  for (const ref of refs) {
    const sourceGroupName = ref.doc_groups_doc_document_references_source_group_idTodoc_groups?.name ?? ''
    const targetGroup = ref.doc_groups_doc_document_references_target_group_idTodoc_groups
    const targetGroupName = targetGroup?.name ?? ''
    const fileName = ref.doc_documents?.title ?? ''

    // 目标组负责人
    if (targetGroup?.owner_user_id) {
      notifications.push(
        NOTIFICATION_TEMPLATES.M26.build({
          toUserId: Number(targetGroup.owner_user_id),
          fileName,
          sourceGroupName,
          targetGroupName,
        }),
      )
    }

    // 组管理员（role=1）
    const admins = await prisma.doc_group_members.findMany({
      where: {
        group_id: targetGroup?.id,
        role: 1,
        deleted_at: null,
      },
      select: { user_id: true },
    })
    for (const admin of admins) {
      if (targetGroup?.owner_user_id && Number(admin.user_id) === Number(targetGroup.owner_user_id)) continue
      notifications.push(
        NOTIFICATION_TEMPLATES.M26.build({
          toUserId: Number(admin.user_id),
          fileName,
          sourceGroupName,
          targetGroupName,
        }),
      )
    }
  }

  // 删除引用关系
  await prisma.doc_document_references.deleteMany({ where: { source_document_id: docId } })

  // 发通知
  if (notifications.length > 0) {
    await createNotifications(notifications)
  }

  return refs.length
}
