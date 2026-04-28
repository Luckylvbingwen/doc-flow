<template>
	<div class="df-comment-thread" :class="{ 'df-comment-thread--readonly': readonly }">
		<!-- 评论列表 -->
		<div v-if="comments.length > 0" class="df-comment-list">
			<TransitionGroup name="df-comment">
				<div v-for="comment in comments" :key="comment.id" class="df-comment-item">
					<!-- 主评论 -->
					<div class="df-comment-row">
						<div
class="df-comment-avatar"
							:style="{ background: comment.user.avatar ? 'none' : (comment.user.color || '#a1a1aa') }"
							:title="comment.user.name">
							<img
v-if="comment.user.avatar" :src="comment.user.avatar" :alt="comment.user.name"
								class="df-comment-avatar__img">
							<template v-else>{{ comment.user.name[0] }}</template>
						</div>
						<div class="df-comment-body">
							<div class="df-comment-header">
								<span class="df-comment-name">{{ comment.user.name }}</span>
								<span class="df-comment-time">{{ comment.time }}</span>
							</div>
							<div class="df-comment-content">{{ comment.content }}</div>
							<div v-if="!readonly" class="df-comment-actions">
								<button class="df-comment-action-btn" @click="toggleReplyBox(comment.id)">
									<el-icon :size="13">
										<ChatLineSquare />
									</el-icon>
									回复
								</button>
								<el-popconfirm
v-if="comment.deletable" title="确定删除这条评论？" confirm-button-text="删除"
									cancel-button-text="取消" confirm-button-type="danger" width="200"
									@confirm="$emit('delete', comment.id)">
									<template #reference>
										<button class="df-comment-action-btn df-comment-action-btn--danger">
											<el-icon :size="13">
												<Delete />
											</el-icon>
											删除
										</button>
									</template>
								</el-popconfirm>
							</div>

							<!-- 回复输入框 -->
							<Transition name="df-reply-box">
								<div v-if="activeReplyId === comment.id" class="df-reply-input-wrap">
									<div class="df-reply-input-label">
										回复 {{ comment.user.name }}：
									</div>
									<el-input
ref="replyInputRef" v-model="replyContent" type="textarea" :rows="2" :maxlength="500"
										show-word-limit placeholder="输入回复…" resize="none" @keydown.ctrl.enter="submitReply(comment.id)"
										@keydown.meta.enter="submitReply(comment.id)" />
									<div class="df-reply-input-footer">
										<span class="df-reply-input-hint">Ctrl + Enter 发送</span>
										<div class="df-reply-input-actions">
											<el-button size="small" @click="cancelReply">
												取消
											</el-button>
											<el-button
type="primary" size="small" :disabled="!replyContent.trim()"
												@click="submitReply(comment.id)">
												发送回复
											</el-button>
										</div>
									</div>
								</div>
							</Transition>

							<!-- 嵌套回复列表 -->
							<div v-if="comment.replies && comment.replies.length > 0" class="df-comment-replies">
								<div v-for="reply in comment.replies" :key="reply.id" class="df-comment-row df-comment-row--reply">
									<div
class="df-comment-avatar df-comment-avatar--sm"
										:style="{ background: reply.user.avatar ? 'none' : (reply.user.color || '#a1a1aa') }"
										:title="reply.user.name">
										<img
v-if="reply.user.avatar" :src="reply.user.avatar" :alt="reply.user.name"
											class="df-comment-avatar__img">
										<template v-else>{{ reply.user.name[0] }}</template>
									</div>
									<div class="df-comment-body">
										<div class="df-comment-header">
											<span class="df-comment-name">{{ reply.user.name }}</span>
											<span class="df-comment-time">{{ reply.time }}</span>
										</div>
										<div class="df-comment-content">
											<span v-if="comment.user.name !== reply.user.name" class="df-comment-mention">
												@{{ comment.user.name }}
											</span>
											{{ reply.content }}
										</div>
										<div v-if="!readonly" class="df-comment-actions">
											<el-popconfirm
v-if="reply.deletable" title="确定删除这条回复？" confirm-button-text="删除"
												cancel-button-text="取消" confirm-button-type="danger" width="200"
												@confirm="$emit('delete', reply.id)">
												<template #reference>
													<button class="df-comment-action-btn df-comment-action-btn--danger">
														<el-icon :size="12">
															<Delete />
														</el-icon>
														删除
													</button>
												</template>
											</el-popconfirm>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</TransitionGroup>
		</div>

		<!-- 空态 -->
		<EmptyState v-else-if="!loading" preset="no-content" title="暂无评论" description="发表第一条评论开始讨论" compact />

		<!-- 加载态 -->
		<div v-if="loading" class="df-comment-loading">
			<el-icon class="is-loading" :size="20" color="var(--df-primary)">
				<Loading />
			</el-icon>
			<span>加载评论中…</span>
		</div>

		<!-- 评论输入区 -->
		<div v-if="!readonly && !loading" class="df-comment-composer">
			<div
class="df-comment-avatar"
				:style="{ background: currentUser.avatar ? 'none' : (currentUser.color || 'var(--df-primary)') }">
				<img v-if="currentUser.avatar" :src="currentUser.avatar" :alt="currentUser.name" class="df-comment-avatar__img">
				<template v-else>{{ currentUser.name[0] }}</template>
			</div>
			<div class="df-comment-composer-body">
				<el-input
v-model="newComment" type="textarea" :rows="3" :maxlength="1000" show-word-limit placeholder="输入评论…"
					resize="none" @keydown.ctrl.enter="submitComment" @keydown.meta.enter="submitComment" />
				<div class="df-comment-composer-footer">
					<span class="df-comment-composer-hint">Ctrl + Enter 发送</span>
					<el-button type="primary" size="small" :disabled="!newComment.trim()" @click="submitComment">
						发送评论
					</el-button>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ChatLineSquare, Delete, Loading } from '@element-plus/icons-vue'

export interface CommentUser {
	name: string
	avatar?: string
	color?: string
}

export interface CommentItem {
	id: string | number
	user: CommentUser
	content: string
	time: string
	replies?: CommentItem[]
	deletable?: boolean
}

withDefaults(
	defineProps<{
		comments: CommentItem[]
		currentUser: CommentUser
		readonly?: boolean
		loading?: boolean
	}>(),
	{
		readonly: false,
		loading: false,
	}
)

const emit = defineEmits<{
	submit: [content: string]
	reply: [payload: { commentId: string | number; content: string }]
	delete: [commentId: string | number]
}>()

const newComment = ref('')
const replyContent = ref('')
const activeReplyId = ref<string | number | null>(null)
const replyInputRef = ref()

function toggleReplyBox(commentId: string | number) {
	if (activeReplyId.value === commentId) {
		cancelReply()
		return
	}
	activeReplyId.value = commentId
	replyContent.value = ''
	nextTick(() => {
		const textareaEl = replyInputRef.value?.[0]?.$el?.querySelector('textarea') ?? replyInputRef.value?.$el?.querySelector('textarea')
		textareaEl?.focus()
	})
}

function cancelReply() {
	activeReplyId.value = null
	replyContent.value = ''
}

function submitReply(commentId: string | number) {
	const content = replyContent.value.trim()
	if (!content) return
	emit('reply', { commentId, content })
	cancelReply()
}

function submitComment() {
	const content = newComment.value.trim()
	if (!content) return
	emit('submit', content)
	newComment.value = ''
}
</script>
