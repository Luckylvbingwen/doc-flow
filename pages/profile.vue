<template>
	<section class="pf-page-stack">
		<PageTitle title="个人中心" subtitle="管理个人信息、查看我的文档与操作记录">
			<template #actions>
				<el-button type="primary" @click="editModalVisible = true">
					<el-icon>
						<Edit />
					</el-icon>编辑资料
				</el-button>
			</template>
		</PageTitle>

		<!-- ── 用户信息卡 ── -->
		<div class="pf-card profile-head">
			<div class="pf-user-avatar lg">刘</div>
			<div class="profile-head-info">
				<h4>刘思远</h4>
				<p class="pf-muted">系统管理员 · liusy@co.com</p>
				<div class="profile-stats">
					<span><strong>36</strong> 篇文档</span>
					<span><strong>12</strong> 个收藏</span>
					<span><strong>5</strong> 待审批</span>
					<span class="profile-join">加入于 2024-06-15</span>
				</div>
			</div>
		</div>

		<!-- ── Tabs ── -->
		<TabBar v-model="activeTab" :tabs="profileTabs" />

		<!-- Tab: 我的文档 -->
		<template v-if="activeTab === 'docs'">
			<DataTable
v-model:page="docPage" v-model:page-size="docPageSize" :data="pagedDocs" :columns="docColumns"
				:total="filteredDocs.length" :loading="docLoading" show-search search-placeholder="搜索文档标题…"
				:action-width="160" @search="onDocSearch" @row-click="onDocRowClick">
				<template #toolbar>
					<el-button @click="onExportClick">
						<el-icon>
							<Download />
						</el-icon>导出列表
					</el-button>
				</template>
				<template #title="{ row }">
					<span class="doc-title-link">{{ row.title }}</span>
				</template>
				<template #action="{ row }">
					<el-button link type="primary" size="small" @click.stop="onDocRowClick(row)">
						查看
					</el-button>
					<el-button link type="primary" size="small" @click.stop="onDocEdit(row)">
						编辑
					</el-button>
					<el-button link type="danger" size="small" @click.stop="onDocDelete(row)">
						删除
					</el-button>
				</template>
			</DataTable>
		</template>

		<!-- Tab: 操作日志 -->
		<template v-if="activeTab === 'logs'">
			<DataTable
v-model:page="logPage" v-model:page-size="logPageSize" :data="pagedLogs" :columns="logColumns"
				:total="mockLogs.length" :show-pagination="true" show-index />
		</template>

		<!-- Tab: 安全设置 -->
		<template v-if="activeTab === 'security'">
			<div class="pf-card">
				<div class="profile-security">
					<div class="security-item">
						<div>
							<h5>登录密码</h5>
							<p class="pf-muted">上次修改：2025-12-01</p>
						</div>
						<el-button size="small" @click="changePwdVisible = true">修改密码</el-button>
					</div>
					<div class="security-item">
						<div>
							<h5>多因素认证</h5>
							<p class="pf-muted">已绑定飞书账号进行二次认证</p>
						</div>
						<el-tag type="success" size="small">已开启</el-tag>
					</div>
					<div class="security-item">
						<div>
							<h5>登录设备</h5>
							<p class="pf-muted">当前共有 3 台设备保持登录状态</p>
						</div>
						<el-button size="small" type="danger" plain>退出全部</el-button>
					</div>
				</div>
			</div>
		</template>

		<!-- ── 文档详情抽屉 ── -->
		<DetailDrawer v-model="drawerVisible" :title="currentDoc?.title || '文档详情'">
			<template v-if="currentDoc">
				<el-descriptions :column="1" border>
					<el-descriptions-item label="文档标题">{{ currentDoc.title }}</el-descriptions-item>
					<el-descriptions-item label="所属仓库">{{ currentDoc.repo }}</el-descriptions-item>
					<el-descriptions-item label="状态">
						<el-tag :type="statusEnumMap[currentDoc.status]?.type" size="small">
							{{ statusEnumMap[currentDoc.status]?.label }}
						</el-tag>
					</el-descriptions-item>
					<el-descriptions-item label="标签">
						<el-tag v-for="tag in currentDoc.tags" :key="tag" size="small" class="doc-tag">
							{{ tag }}
						</el-tag>
					</el-descriptions-item>
					<el-descriptions-item label="创建时间">{{ currentDoc.createdAt }}</el-descriptions-item>
					<el-descriptions-item label="最后更新">{{ currentDoc.updatedAt }}</el-descriptions-item>
				</el-descriptions>
				<div class="drawer-doc-content">
					<h5>文档摘要</h5>
					<p>{{ currentDoc.summary }}</p>
				</div>
			</template>
			<template #footer>
				<el-button @click="drawerVisible = false">关闭</el-button>
				<el-button type="primary" @click="onDocEdit(currentDoc)">编辑文档</el-button>
			</template>
		</DetailDrawer>

		<!-- ── 编辑资料弹窗 ── -->
		<Modal v-model="editModalVisible" title="编辑个人资料" :confirm-loading="editLoading" @confirm="onEditConfirm">
			<el-form :model="editForm" label-width="80px" label-position="right">
				<el-form-item label="姓名">
					<el-input v-model="editForm.name" placeholder="请输入姓名" />
				</el-form-item>
				<el-form-item label="邮箱">
					<el-input v-model="editForm.email" placeholder="请输入邮箱" />
				</el-form-item>
				<el-form-item label="部门">
					<el-select v-model="editForm.department" placeholder="选择部门" style="width: 100%;">
						<el-option label="技术部" value="tech" />
						<el-option label="产品部" value="product" />
						<el-option label="运营部" value="ops" />
						<el-option label="管理层" value="management" />
					</el-select>
				</el-form-item>
				<el-form-item label="个人简介">
					<el-input v-model="editForm.bio" type="textarea" :rows="3" placeholder="一句话介绍自己" />
				</el-form-item>
			</el-form>
		</Modal>

		<!-- ── 修改密码弹窗 ── -->
		<Modal
v-model="changePwdVisible" title="修改密码" width="440px" confirm-text="确认修改" :confirm-loading="pwdLoading"
			@confirm="onChangePwd">
			<el-form label-width="80px" label-position="right">
				<el-form-item label="当前密码">
					<el-input type="password" show-password placeholder="请输入当前密码" />
				</el-form-item>
				<el-form-item label="新密码">
					<el-input type="password" show-password placeholder="请输入新密码" />
				</el-form-item>
				<el-form-item label="确认密码">
					<el-input type="password" show-password placeholder="再次输入新密码" />
				</el-form-item>
			</el-form>
		</Modal>
	</section>
</template>

<script setup>
import { Edit, Download } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

definePageMeta({
	layout: 'prototype'
})
useHead({ title: '个人中心 - DocFlow' })

// ── 状态 ──
const activeTab = ref('docs')

const profileTabs = [
	{ label: '我的文档', value: 'docs', count: 12 },
	{ label: '操作日志', value: 'logs', count: 12 },
	{ label: '安全设置', value: 'security' }
]

// ── 文档表格 ──
const docPage = ref(1)
const docPageSize = ref(10)
const docLoading = ref(false)
const docSearchKey = ref('')

const statusEnum = [
	{ value: 'published', label: '已发布', type: 'success' },
	{ value: 'draft', label: '草稿', type: 'info' },
	{ value: 'review', label: '审核中', type: 'warning' },
	{ value: 'archived', label: '已归档', type: 'info' }
]

const statusEnumMap = {
	published: { label: '已发布', type: 'success' },
	draft: { label: '草稿', type: 'info' },
	review: { label: '审核中', type: 'warning' },
	archived: { label: '已归档', type: 'info' }
}

const docColumns = [
	{ prop: 'title', label: '文档标题', minWidth: 220, slot: 'title' },
	{ prop: 'repo', label: '所属仓库', width: 140 },
	{ prop: 'status', label: '状态', width: 100, enum: statusEnum },
	{ prop: 'updatedAt', label: '最近更新', width: 170, dateFormat: 'datetime', sortable: true },
	{ prop: 'createdAt', label: '创建时间', width: 170, dateFormat: 'datetime', sortable: true }
]

const mockDocs = ref([
	{ id: 1, title: 'DocFlow 系统架构设计文档', repo: '技术架构库', status: 'published', tags: ['架构', '系统设计'], createdAt: '2025-10-12T08:30:00', updatedAt: '2026-03-20T14:22:00', summary: '描述了 DocFlow 企业文档管理系统的整体架构设计，包括前端 Nuxt3 + Element Plus、后端 Nitro + Prisma 的技术栈选型与模块划分。' },
	{ id: 2, title: 'API 接口规范 v2.0', repo: '技术架构库', status: 'published', tags: ['API', '规范'], createdAt: '2025-11-03T10:00:00', updatedAt: '2026-03-18T09:15:00', summary: 'RESTful API 设计规范，涵盖命名约定、错误码体系、分页参数和认证机制等。' },
	{ id: 3, title: '2026 Q1 产品迭代计划', repo: '产品需求库', status: 'review', tags: ['计划', 'Q1'], createdAt: '2026-01-05T09:00:00', updatedAt: '2026-03-22T16:45:00', summary: '2026年第一季度产品迭代规划，包含文档协同编辑、版本对比、审批流程优化等核心需求。' },
	{ id: 4, title: '用户权限模型说明', repo: '技术架构库', status: 'published', tags: ['权限', 'RBAC'], createdAt: '2025-09-20T14:00:00', updatedAt: '2026-02-28T11:30:00', summary: '基于 RBAC 的用户权限模型设计，支持角色继承、资源级细粒度授权。' },
	{ id: 5, title: '飞书集成方案（草稿）', repo: '集成对接库', status: 'draft', tags: ['飞书', '集成'], createdAt: '2026-02-10T16:20:00', updatedAt: '2026-03-15T10:00:00', summary: '飞书开放平台 Webhook 通知集成方案，包括登录授权、消息推送和审批回调。' },
	{ id: 6, title: '部署运维手册 v1.2', repo: '运维知识库', status: 'published', tags: ['运维', '部署'], createdAt: '2025-08-15T11:00:00', updatedAt: '2026-01-10T08:50:00', summary: '生产环境部署流程、Docker 编排配置、CI/CD 流水线及监控告警配置手册。' },
	{ id: 7, title: '数据库设计文档', repo: '技术架构库', status: 'published', tags: ['数据库', 'Prisma'], createdAt: '2025-10-01T09:30:00', updatedAt: '2026-03-05T13:20:00', summary: 'Prisma Schema 设计说明，包含实体关系图、索引策略和数据迁移方案。' },
	{ id: 8, title: '前端组件库使用指南', repo: '技术架构库', status: 'draft', tags: ['组件', '前端'], createdAt: '2026-03-10T15:00:00', updatedAt: '2026-03-24T17:30:00', summary: 'DataTable、Modal、DetailDrawer 等公共组件的 API 说明和使用示例。' },
	{ id: 9, title: '审批流程配置说明', repo: '产品需求库', status: 'review', tags: ['审批', '流程'], createdAt: '2026-02-20T10:00:00', updatedAt: '2026-03-21T14:00:00', summary: '多级审批流的配置方式，支持串行、并行审批和条件分支。' },
	{ id: 10, title: '历史归档策略', repo: '运维知识库', status: 'archived', tags: ['归档', '策略'], createdAt: '2025-06-01T08:00:00', updatedAt: '2025-12-31T18:00:00', summary: '文档超过保留期限后的自动归档策略和恢复机制。' },
	{ id: 11, title: '安全审计报告 2025', repo: '合规审计库', status: 'published', tags: ['安全', '审计'], createdAt: '2026-01-15T09:00:00', updatedAt: '2026-02-20T10:30:00', summary: '2025年度信息安全审计报告，涵盖漏洞扫描、渗透测试、权限审计和数据合规四个维度。' },
	{ id: 12, title: '新员工入职指引', repo: '人力资源库', status: 'published', tags: ['入职', 'HR'], createdAt: '2025-07-10T14:00:00', updatedAt: '2026-03-01T09:00:00', summary: '新员工入职后系统账号开通、文档权限申请和常用工具使用指南。' },
	{ id: 13, title: '新员工入职指引', repo: '人力资源库', status: 'published', tags: ['入职', 'HR'], createdAt: '2025-07-10T14:00:00', updatedAt: '2026-03-01T09:00:00', summary: '新员工入职后系统账号开通、文档权限申请和常用工具使用指南。' },
	{ id: 14, title: '新员工入职指引', repo: '人力资源库', status: 'published', tags: ['入职', 'HR'], createdAt: '2025-07-10T14:00:00', updatedAt: '2026-03-01T09:00:00', summary: '新员工入职后系统账号开通、文档权限申请和常用工具使用指南。' },
	{ id: 15, title: '新员工入职指引', repo: '人力资源库', status: 'published', tags: ['入职', 'HR'], createdAt: '2025-07-10T14:00:00', updatedAt: '2026-03-01T09:00:00', summary: '新员工入职后系统账号开通、文档权限申请和常用工具使用指南。' },
	{ id: 16, title: '新员工入职指引', repo: '人力资源库', status: 'published', tags: ['入职', 'HR'], createdAt: '2025-07-10T14:00:00', updatedAt: '2026-03-01T09:00:00', summary: '新员工入职后系统账号开通、文档权限申请和常用工具使用指南。' },
	{ id: 17, title: '新员工入职指引', repo: '人力资源库', status: 'published', tags: ['入职', 'HR'], createdAt: '2025-07-10T14:00:00', updatedAt: '2026-03-01T09:00:00', summary: '新员工入职后系统账号开通、文档权限申请和常用工具使用指南。' },
	{ id: 18, title: '新员工入职指引', repo: '人力资源库', status: 'published', tags: ['入职', 'HR'], createdAt: '2025-07-10T14:00:00', updatedAt: '2026-03-01T09:00:00', summary: '新员工入职后系统账号开通、文档权限申请和常用工具使用指南。' },
	{ id: 19, title: '新员工入职指引', repo: '人力资源库', status: 'published', tags: ['入职', 'HR'], createdAt: '2025-07-10T14:00:00', updatedAt: '2026-03-01T09:00:00', summary: '新员工入职后系统账号开通、文档权限申请和常用工具使用指南。' },
	{ id: 20, title: '新员工入职指引', repo: '人力资源库', status: 'published', tags: ['入职', 'HR'], createdAt: '2025-07-10T14:00:00', updatedAt: '2026-03-01T09:00:00', summary: '新员工入职后系统账号开通、文档权限申请和常用工具使用指南。' },
	{ id: 21, title: '新员工入职指引', repo: '人力资源库', status: 'published', tags: ['入职', 'HR'], createdAt: '2025-07-10T14:00:00', updatedAt: '2026-03-01T09:00:00', summary: '新员工入职后系统账号开通、文档权限申请和常用工具使用指南。' },
	{ id: 22, title: '新员工入职指引', repo: '人力资源库', status: 'published', tags: ['入职', 'HR'], createdAt: '2025-07-10T14:00:00', updatedAt: '2026-03-01T09:00:00', summary: '新员工入职后系统账号开通、文档权限申请和常用工具使用指南。' },
	{ id: 23, title: '新员工入职指引', repo: '人力资源库', status: 'published', tags: ['入职', 'HR'], createdAt: '2025-07-10T14:00:00', updatedAt: '2026-03-01T09:00:00', summary: '新员工入职后系统账号开通、文档权限申请和常用工具使用指南。' },
])

const filteredDocs = computed(() => {
	if (!docSearchKey.value) return mockDocs.value
	const key = docSearchKey.value.toLowerCase()
	return mockDocs.value.filter(
		(d) => d.title.toLowerCase().includes(key) || d.repo.toLowerCase().includes(key)
	)
})

const pagedDocs = computed(() => {
	const start = (docPage.value - 1) * docPageSize.value
	return filteredDocs.value.slice(start, start + docPageSize.value)
})

const onDocSearch = (keyword) => {
	docSearchKey.value = keyword
	docPage.value = 1
}

// ── 文档详情抽屉 ──
const drawerVisible = ref(false)
const currentDoc = ref(null)

const onDocRowClick = (row) => {
	currentDoc.value = row
	drawerVisible.value = true
}

const onDocEdit = (row) => {
	ElMessage.info(`编辑文档：${row.title}`)
}

const onDocDelete = (row) => {
	ElMessage.warning(`删除文档：${row.title}（模拟操作）`)
}

const onExportClick = () => {
	ElMessage.success('导出列表（模拟操作）')
}

// ── 操作日志 ──
const logPage = ref(1)
const logPageSize = ref(10)

const actionEnum = [
	{ value: 'create', label: '创建', type: 'success' },
	{ value: 'edit', label: '编辑', type: 'info' },
	{ value: 'delete', label: '删除', type: 'danger' },
	{ value: 'publish', label: '发布', type: 'success' },
	{ value: 'review', label: '提交审核', type: 'warning' },
	{ value: 'login', label: '登录', type: 'info' }
]

const logColumns = [
	{ prop: 'action', label: '操作类型', width: 120, enum: actionEnum },
	{ prop: 'target', label: '操作对象', minWidth: 200 },
	{ prop: 'ip', label: 'IP 地址', width: 140 },
	{ prop: 'time', label: '操作时间', width: 170, dateFormat: 'datetime', sortable: true }
]

const mockLogs = ref([
	{ id: 1, action: 'edit', target: '前端组件库使用指南', ip: '192.168.1.101', time: '2026-03-24T17:30:00' },
	{ id: 2, action: 'publish', target: 'API 接口规范 v2.0', ip: '192.168.1.101', time: '2026-03-24T15:10:00' },
	{ id: 3, action: 'review', target: '2026 Q1 产品迭代计划', ip: '192.168.1.101', time: '2026-03-22T16:45:00' },
	{ id: 4, action: 'create', target: '前端组件库使用指南', ip: '192.168.1.101', time: '2026-03-10T15:00:00' },
	{ id: 5, action: 'edit', target: '数据库设计文档', ip: '10.0.0.55', time: '2026-03-05T13:20:00' },
	{ id: 6, action: 'login', target: '系统登录', ip: '192.168.1.101', time: '2026-03-05T09:00:00' },
	{ id: 7, action: 'edit', target: '用户权限模型说明', ip: '192.168.1.101', time: '2026-02-28T11:30:00' },
	{ id: 8, action: 'review', target: '审批流程配置说明', ip: '10.0.0.55', time: '2026-02-20T10:00:00' },
	{ id: 9, action: 'create', target: '飞书集成方案（草稿）', ip: '192.168.1.101', time: '2026-02-10T16:20:00' },
	{ id: 10, action: 'delete', target: '废弃接口文档 v0.9', ip: '192.168.1.101', time: '2026-01-20T11:00:00' },
	{ id: 11, action: 'login', target: '系统登录', ip: '10.0.0.55', time: '2026-01-15T08:30:00' },
	{ id: 12, action: 'publish', target: '安全审计报告 2025', ip: '192.168.1.101', time: '2026-01-15T09:00:00' }
])

const pagedLogs = computed(() => {
	const start = (logPage.value - 1) * logPageSize.value
	return mockLogs.value.slice(start, start + logPageSize.value)
})

// ── 编辑资料弹窗 ──
const editModalVisible = ref(false)
const editLoading = ref(false)
const editForm = reactive({
	name: '刘思远',
	email: 'liusy@co.com',
	department: 'tech',
	bio: '全栈工程师，负责 DocFlow 系统的架构设计与核心开发。'
})

const onEditConfirm = () => {
	editLoading.value = true
	setTimeout(() => {
		editLoading.value = false
		editModalVisible.value = false
		ElMessage.success('资料已更新（模拟操作）')
	}, 1000)
}

// ── 修改密码弹窗 ──
const changePwdVisible = ref(false)
const pwdLoading = ref(false)

const onChangePwd = () => {
	pwdLoading.value = true
	setTimeout(() => {
		pwdLoading.value = false
		changePwdVisible.value = false
		ElMessage.success('密码已修改（模拟操作）')
	}, 1000)
}
</script>

<style lang="scss" scoped>
.profile-head {
	display: flex;
	align-items: center;
	gap: 20px;

	&-info {
		h4 {
			margin: 0 0 4px;
			font-size: 18px;
			font-weight: 600;
			color: var(--df-text);
		}
	}
}

.profile-stats {
	display: flex;
	align-items: center;
	gap: 20px;
	margin-top: 10px;
	font-size: 13px;
	color: var(--df-subtext);

	strong {
		font-size: 16px;
		font-weight: 700;
		color: var(--df-text);
		margin-right: 2px;
	}
}

.profile-join {
	color: var(--df-subtext);
	opacity: 0.7;
}

/* 文档标题链接样式 */
.doc-title-link {
	color: var(--df-primary);
	cursor: pointer;
	font-weight: 500;

	&:hover {
		text-decoration: underline;
	}
}

/* 文档标签间距 */
.doc-tag+.doc-tag {
	margin-left: 4px;
}

/* 抽屉内文档内容区域 */
.drawer-doc-content {
	margin-top: 20px;

	h5 {
		font-size: 14px;
		font-weight: 600;
		color: var(--df-text);
		margin: 0 0 8px;
	}

	p {
		font-size: 13px;
		color: var(--df-subtext);
		line-height: 1.7;
	}
}

/* 安全设置 */
.profile-security {
	display: flex;
	flex-direction: column;
	gap: 0;
}

.security-item {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 16px 0;
	border-bottom: 1px solid var(--df-border);

	&:last-child {
		border-bottom: none;
	}

	h5 {
		margin: 0 0 4px;
		font-size: 14px;
		font-weight: 600;
		color: var(--df-text);
	}
}
</style>
