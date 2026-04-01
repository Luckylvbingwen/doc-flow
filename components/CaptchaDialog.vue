<template>
	<Teleport to="body">
		<Transition name="captcha-fade">
			<div v-if="visible" class="captcha-overlay" @click.self="handleCancel">
				<div class="captcha-panel">
					<!-- 顶部栏 -->
					<div class="captcha-header">
						<div class="captcha-header-left">
							<span class="captcha-shield">&#x1F6E1;</span>
							<span class="captcha-title">安全验证</span>
						</div>
						<button class="captcha-close" @click="handleCancel">&times;</button>
					</div>

					<!-- 提示文字 -->
					<p class="captcha-prompt">
						{{ prompt }}
						<span v-if="clicks.length > 0 && !autoConfirming" class="captcha-count">
							({{ clicks.length }}/{{ targetCount }})
						</span>
					</p>

					<!-- 进度指示器 -->
					<div class="captcha-progress">
						<div
v-for="i in targetCount" :key="i" class="captcha-progress-dot"
							:class="{ active: i <= clicks.length }" />
					</div>

					<!-- 画布 -->
					<div
class="captcha-canvas" :style="{ width: canvasWidth + 'px', height: canvasHeight + 'px' }"
						@click="handleImageClick">
						<div class="captcha-svg" v-html="sanitize(captchaSvg)" />
						<TransitionGroup name="captcha-dot-pop">
							<div
v-for="(pt, idx) in clicks" :key="`${pt.x}-${pt.y}`" class="captcha-dot"
								:style="{ left: pt.x + 'px', top: pt.y + 'px' }">
								{{ idx + 1 }}
							</div>
						</TransitionGroup>
						<!-- loading 骨架 -->
						<div v-if="loading" class="captcha-canvas-loading">
							<el-icon class="is-loading" :size="28">
								<Loading />
							</el-icon>
						</div>
						<!-- 自动确认倒计时遮罩 -->
						<Transition name="captcha-fade">
							<div v-if="autoConfirming" class="captcha-canvas-countdown">
								<div class="captcha-countdown-ring">
									<svg viewBox="0 0 40 40">
										<circle cx="20" cy="20" r="17" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="3" />
										<circle
class="captcha-countdown-circle" cx="20" cy="20" r="17" fill="none" stroke="#fff"
											stroke-width="3" stroke-linecap="round" :style="{ animationDuration: autoConfirmDelay + 'ms' }" />
									</svg>
								</div>
								<span class="captcha-countdown-text">验证中…</span>
								<button class="captcha-countdown-undo" @click.stop="undoClick">撤回重选</button>
							</div>
						</Transition>
					</div>

					<!-- 底部操作栏 -->
					<div class="captcha-footer">
						<div class="captcha-footer-left">
							<button class="captcha-action-btn" title="刷新验证码" @click="refreshCaptcha">
								<el-icon>
									<Refresh />
								</el-icon>
								<span>换一张</span>
							</button>
							<button
class="captcha-action-btn" :disabled="clicks.length === 0 || autoConfirming" title="撤回上一个"
								@click="undoClick">
								<el-icon>
									<RefreshLeft />
								</el-icon>
								<span>撤回</span>
							</button>
						</div>
						<span v-if="clicks.length < targetCount" class="captcha-hint-text">
							还需点击 {{ targetCount - clicks.length }} 个
						</span>
					</div>
				</div>
			</div>
		</Transition>
	</Teleport>
</template>

<script setup lang="ts">
import { Refresh, RefreshLeft, Loading } from '@element-plus/icons-vue'
import type { ApiResult, CaptchaData } from '~/types/api'

const { sanitize } = useSanitize()

const emit = defineEmits<{
	confirm: [clicks: { x: number; y: number }[], token: string]
	cancel: []
}>()

const visible = defineModel<boolean>('visible', { default: false })
const captchaSvg = ref('')
const captchaToken = ref('')
const prompt = ref('请依次点击图中文字')
const canvasWidth = ref(320)
const canvasHeight = ref(180)
const targetCount = ref(3)
const clicks = ref<{ x: number; y: number }[]>([])
const loading = ref(false)

// 自动确认
const autoConfirming = ref(false)
const autoConfirmDelay = 1500
let autoConfirmTimer: ReturnType<typeof setTimeout> | null = null

const clearAutoConfirm = () => {
	if (autoConfirmTimer) {
		clearTimeout(autoConfirmTimer)
		autoConfirmTimer = null
	}
	autoConfirming.value = false
}

const startAutoConfirm = () => {
	autoConfirming.value = true
	autoConfirmTimer = setTimeout(() => {
		autoConfirming.value = false
		emit('confirm', [...clicks.value], captchaToken.value)
	}, autoConfirmDelay)
}

const refreshCaptcha = async () => {
	clearAutoConfirm()
	clicks.value = []
	loading.value = true
	try {
		const res = await $fetch<ApiResult<CaptchaData>>('/api/auth/captcha')
		if (res.success && res.data) {
			captchaSvg.value = res.data.svg
			captchaToken.value = res.data.token
			prompt.value = res.data.prompt
			canvasWidth.value = res.data.width
			canvasHeight.value = res.data.height
		}
	} catch {
		captchaSvg.value = ''
		prompt.value = '加载失败，请点击换一张'
	} finally {
		loading.value = false
	}
}

const handleImageClick = (e: MouseEvent) => {
	if (loading.value || autoConfirming.value) return
	if (clicks.value.length >= targetCount.value) return
	const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
	const x = Math.round(e.clientX - rect.left)
	const y = Math.round(e.clientY - rect.top)
	clicks.value.push({ x, y })

	// 点满后自动开始倒计时
	if (clicks.value.length >= targetCount.value) {
		startAutoConfirm()
	}
}

const undoClick = () => {
	clearAutoConfirm()
	clicks.value.pop()
}

const handleCancel = () => {
	clearAutoConfirm()
	visible.value = false
	emit('cancel')
}

watch(visible, (val) => {
	if (val) {
		clearAutoConfirm()
		clicks.value = []
		captchaSvg.value = ''
		captchaToken.value = ''
		prompt.value = ''
		refreshCaptcha()
	}
})
</script>

<style lang="scss" scoped>
/* ---- overlay & transitions ---- */
.captcha-overlay {
	position: fixed;
	inset: 0;
	z-index: 2050;
	display: flex;
	align-items: center;
	justify-content: center;
	background: rgba(0, 0, 0, 0.45);
	backdrop-filter: blur(4px);
}

.captcha-fade-enter-active,
.captcha-fade-leave-active {
	transition: opacity 0.25s ease;
}

.captcha-fade-enter-from,
.captcha-fade-leave-to {
	opacity: 0;
}

/* ---- panel ---- */
.captcha-panel {
	width: 380px;
	background: #fff;
	border-radius: 16px;
	box-shadow: 0 20px 60px rgba(0, 0, 0, 0.18), 0 0 0 1px rgba(255, 255, 255, 0.1) inset;
	overflow: hidden;
	animation: captcha-slide-in 0.3s ease;
}

@keyframes captcha-slide-in {
	from {
		opacity: 0;
		transform: translateY(16px) scale(0.97);
	}

	to {
		opacity: 1;
		transform: translateY(0) scale(1);
	}
}

/* ---- header ---- */
.captcha-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 16px 20px 0;
}

.captcha-header-left {
	display: flex;
	align-items: center;
	gap: 8px;
}

.captcha-shield {
	font-size: 18px;
}

.captcha-title {
	font-size: 16px;
	font-weight: 600;
	color: #1f2937;
}

.captcha-close {
	width: 28px;
	height: 28px;
	border: none;
	background: #f3f4f6;
	border-radius: 8px;
	font-size: 18px;
	color: #9ca3af;
	cursor: pointer;
	display: flex;
	align-items: center;
	justify-content: center;
	transition: all 0.15s ease;
	line-height: 1;

	&:hover {
		background: #e5e7eb;
		color: #374151;
	}
}

/* ---- prompt ---- */
.captcha-prompt {
	margin: 14px 20px 0;
	font-size: 13px;
	color: #6b7280;
	line-height: 1.6;
}

.captcha-count {
	color: #3b82f6;
	font-weight: 600;
}

/* ---- progress dots ---- */
.captcha-progress {
	display: flex;
	gap: 6px;
	padding: 10px 20px 0;
}

.captcha-progress-dot {
	width: 8px;
	height: 8px;
	border-radius: 50%;
	background: #e5e7eb;
	transition: all 0.2s ease;

	&.active {
		background: #3b82f6;
		box-shadow: 0 0 8px rgba(59, 130, 246, 0.5);
		transform: scale(1.1);
	}
}

/* ---- canvas ---- */
.captcha-canvas {
	position: relative;
	margin: 12px 20px 0;
	border: 2px solid #e5e7eb;
	border-radius: 12px;
	overflow: hidden;
	cursor: crosshair;
	user-select: none;
	transition: border-color 0.2s ease;

	&:hover {
		border-color: #93c5fd;
	}
}

.captcha-svg {
	width: 100%;
	height: 100%;

	:deep(svg) {
		display: block;
		width: 100%;
		height: 100%;
	}
}

.captcha-canvas-loading {
	position: absolute;
	inset: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	background: rgba(255, 255, 255, 0.8);
	color: #3b82f6;
}

/* ---- click dots ---- */
.captcha-dot {
	position: absolute;
	width: 24px;
	height: 24px;
	border-radius: 50%;
	background: linear-gradient(135deg, #3b82f6, #6366f1);
	color: #fff;
	font-size: 12px;
	font-weight: 700;
	display: flex;
	align-items: center;
	justify-content: center;
	transform: translate(-50%, -50%);
	pointer-events: none;
	box-shadow: 0 2px 8px rgba(59, 130, 246, 0.5), 0 0 0 2px #fff;
}

.captcha-dot-pop-enter-active {
	transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.captcha-dot-pop-enter-from {
	opacity: 0;
	transform: translate(-50%, -50%) scale(0);
}

.captcha-dot-pop-leave-active {
	transition: all 0.15s ease;
}

.captcha-dot-pop-leave-to {
	opacity: 0;
	transform: translate(-50%, -50%) scale(0.5);
}

/* ---- footer ---- */
.captcha-footer {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 14px 20px 16px;
}

.captcha-footer-left {
	display: flex;
	gap: 4px;
}

.captcha-action-btn {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	border: none;
	background: transparent;
	color: #6b7280;
	font-size: 12px;
	padding: 6px 10px;
	border-radius: 8px;
	cursor: pointer;
	transition: all 0.15s ease;

	&:hover:not(:disabled) {
		background: #f3f4f6;
		color: #374151;
	}

	&:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.el-icon {
		font-size: 14px;
	}
}

.captcha-hint-text {
	font-size: 12px;
	color: #9ca3af;
}

/* ---- countdown overlay ---- */
.captcha-canvas-countdown {
	position: absolute;
	inset: 0;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 10px;
	background: rgba(0, 0, 0, 0.55);
	backdrop-filter: blur(2px);
	border-radius: inherit;
}

.captcha-countdown-ring {
	width: 44px;
	height: 44px;

	svg {
		display: block;
		transform: rotate(-90deg);
	}
}

.captcha-countdown-circle {
	stroke-dasharray: 106.8;
	stroke-dashoffset: 0;
	animation: captcha-ring-sweep linear forwards;
}

@keyframes captcha-ring-sweep {
	from {
		stroke-dashoffset: 0;
	}

	to {
		stroke-dashoffset: 106.8;
	}
}

.captcha-countdown-text {
	color: #fff;
	font-size: 14px;
	font-weight: 500;
	letter-spacing: 1px;
}

.captcha-countdown-undo {
	border: 1px solid rgba(255, 255, 255, 0.5);
	background: rgba(255, 255, 255, 0.15);
	color: #fff;
	font-size: 12px;
	padding: 5px 16px;
	border-radius: 999px;
	cursor: pointer;
	transition: all 0.15s ease;

	&:hover {
		background: rgba(255, 255, 255, 0.3);
	}
}
</style>
