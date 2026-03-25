<template>
	<section class="login-page" :style="loginPageStyle">
		<div class="brand-placeholder">
			<div class="brand-icon">DF</div>
			<div class="brand-text">DocFlow 协作平台</div>
		</div>

		<div class="login-content">
			<article class="login-card">
				<img class="login-card-header" :src="loginHeaderSrc" alt="DocFlow" />
				<header class="login-header">
					<h2>账号登录</h2>
					<p>当前为本地账密模式，暂不接入飞书登录。</p>
				</header>

				<el-form ref="formRef" :model="form" :rules="rules" label-position="top" class="login-form"
					@submit.prevent="handleSubmit">
					<el-form-item label="账号（邮箱或飞书 Open ID）" prop="account">
						<el-input v-model="form.account" placeholder="admin@docflow.local" autocomplete="username" clearable
							@keyup.enter="handleSubmit">
							<template #prefix>
								<el-icon>
									<User />
								</el-icon>
							</template>
						</el-input>
					</el-form-item>

					<el-form-item label="密码" prop="password">
						<el-input v-model="form.password" type="password" show-password placeholder="请输入密码"
							autocomplete="current-password" @keyup.enter="handleSubmit">
							<template #prefix>
								<el-icon>
									<Lock />
								</el-icon>
							</template>
						</el-input>
					</el-form-item>

					<div class="login-row">
						<el-checkbox v-model="rememberSession" label="保持会话" />
						<NuxtLink class="preview-link" to="/docs">进入系统预览</NuxtLink>
					</div>

					<el-button class="login-submit" type="primary" :loading="submitting" @click="handleSubmit">
						登录
					</el-button>
				</el-form>

				<section class="login-tips">
					<p>演示账号：admin@docflow.local</p>
					<p>演示密码：Docflow@123（可通过 AUTH_DEMO_PASSWORD 配置）</p>
				</section>
			</article>
		</div>
	</section>
</template>

<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import { Lock, User } from '@element-plus/icons-vue'
import loginBgSrc from '~/assets/images/login-bg.png'
import loginHeaderSrc from '~/assets/images/login-header.png'

const formRef = ref<FormInstance>()
const submitting = ref(false)
const rememberSession = ref(true)
const authStore = useAuthStore()

const loginPageStyle = computed(() => ({
	backgroundImage: `linear-gradient(110deg, rgba(8, 31, 74, 0.7), rgba(14, 44, 96, 0.45) 35%, rgba(16, 56, 122, 0.25) 60%, rgba(255, 255, 255, 0) 85%), url('${loginBgSrc}')`
}))

const form = reactive({
	account: 'admin@docflow.local',
	password: 'Docflow@123'
})

const rules: FormRules = {
	account: [{ required: true, message: '请输入账号', trigger: 'blur' }],
	password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

const handleSubmit = async () => {
	if (!formRef.value) {
		return
	}

	const valid = await formRef.value.validate().catch(() => false)
	if (!valid) {
		return
	}

	submitting.value = true
	try {
		const response = await $fetch<{
			success: boolean
			code: string
			message: string
			data?: {
				token: string
				tokenType: 'Bearer'
				expiresIn: number
				user: {
					id: number
					name: string
					email: string | null
					feishuOpenId: string
				}
			}
		}>('/api/auth/login', {
			method: 'POST',
			body: {
				account: form.account,
				password: form.password
			}
		})

		if (!response.success || !response.data) {
			ElMessage.error(response.message || '登录失败')
			return
		}

		authStore.setSession(response.data)
		ElMessage.success('登录成功，正在进入系统')
		await navigateTo('/docs')
	} catch (error: unknown) {
		const maybeError = error as {
			data?: { message?: string }
		}
		ElMessage.error(maybeError?.data?.message || '登录失败，请稍后重试')
	} finally {
		submitting.value = false
	}
}

onMounted(() => {
	authStore.hydrateSession()
})

definePageMeta({
	layout: 'auth'
})
</script>

<style scoped>
.login-page {
	position: relative;
	min-height: 100vh;
	display: flex;
	align-items: center;
	justify-content: flex-end;
	padding-right: clamp(42px, 7vw, 128px);
	background-position: center center;
	background-size: cover;
	background-repeat: no-repeat;
}

.brand-placeholder {
	position: fixed;
	top: 24px;
	left: 30px;
	z-index: 10;
	display: inline-flex;
	align-items: center;
	gap: 10px;
}

.brand-icon {
	width: 34px;
	height: 34px;
	border-radius: 8px;
	background: rgba(255, 255, 255, 0.24);
	box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.22);
	color: #ffffff;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	font-size: 13px;
	font-weight: 700;
}

.brand-text {
	color: #ffffff;
	font-size: 22px;
	font-weight: 700;
	letter-spacing: 0.6px;
}

.login-content {
	width: 430px;
}

.login-card {
	border-radius: 12px;
	background: rgba(255, 255, 255, 0.96);
	backdrop-filter: blur(2px);
	min-height: 450px;
	padding: 24px 30px 28px;
	box-shadow: 0 18px 38px rgba(15, 48, 138, 0.24);
}

.login-card-header {
	width: 100%;
	height: 92px;
	object-fit: cover;
	border-radius: 8px;
	display: block;
	margin-bottom: 16px;
}

.login-header h2 {
	margin: 0;
	text-align: center;
	color: var(--df-primary);
	font-size: 26px;
	font-weight: 700;
}

.login-header p {
	margin: 8px 0 0;
	color: var(--df-subtext);
	font-size: 13px;
	text-align: center;
}

.login-form {
	margin-top: 20px;
}

.login-form :deep(.el-form-item) {
	margin-bottom: 18px;
}

.login-form :deep(.el-input__wrapper) {
	min-height: 42px;
	border-radius: 6px;
	box-shadow: 0 0 0 1px #d7dde9 inset;
}

.login-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin: 2px 0 16px;
}

.preview-link {
	font-size: 12px;
	color: #6b7280;
}

.preview-link:hover {
	color: var(--df-primary);
}

.login-submit {
	width: 100%;
	height: 44px;
	margin-top: 2px;
	border-radius: 999px;
	font-size: 17px;
	letter-spacing: 3px;
}

.login-tips {
	margin-top: 14px;
	padding: 10px 12px;
	border-radius: 10px;
	border: 1px dashed #c7d2fe;
	background: #eef2ff;
}

.login-tips p {
	margin: 0;
	font-size: 12px;
	color: #4338ca;
}

.login-tips p+p {
	margin-top: 4px;
}

@media (max-width: 900px) {
	.brand-placeholder {
		top: 12px;
		left: 14px;
	}

	.brand-text {
		font-size: 18px;
	}

	.login-page {
		justify-content: center;
		padding: 16px;
		background-position: center left;
	}

	.login-content {
		width: min(100%, 430px);
	}

	.login-card {
		min-height: 420px;
		padding: 22px 18px 22px;
	}
}
</style>
