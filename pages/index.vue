<template>
	<section class="pf-page-stack">
		<PageTitle title="原型落地导航" subtitle="从这里进入各展示页面雏形" />

		<article class="pf-card">
			<h4>原型页面导航</h4>
			<p class="pf-muted">
				已根据 docs/prototype-v21.0.html 搭建展示页面雏形，后续可逐页替换为真实接口与交互。
			</p>
		</article>

		<section class="repo-grid">
			<article v-for="entry in entries" :key="entry.path" class="repo-card">
				<h5>{{ entry.title }}</h5>
				<p>{{ entry.desc }}</p>
				<NuxtLink :to="entry.path">进入页面</NuxtLink>
			</article>
		</section>
	</section>
</template>

<script setup>
definePageMeta({
	layout: 'prototype'
})
useHead({ title: '首页 - DocFlow' })

const entries = [
	{ path: '/docs', title: '共享文档', desc: '组织树 + 仓库卡片主入口。' },
	{ path: '/docs/repo/1', title: '仓库详情', desc: '文件列表与基础配置区域。' },
	{ path: '/docs/file/101', title: '文件详情', desc: '预览、版本、评论与审批记录。' },
	{ path: '/approvals', title: '审批中心', desc: '待我审批、我发起、归档视图。' },
	{ path: '/logs', title: '操作日志', desc: '审计日志检索与查看。' },
	{ path: '/notifications', title: '通知中心', desc: '系统、审批、评论通知。' },
	{ path: '/recycle-bin', title: '回收站', desc: '恢复与永久删除操作。' },
	{ path: '/admin', title: '系统管理', desc: '组织角色权限与系统设置。' },
	{ path: '/profile', title: '个人中心', desc: '我的文档与偏好配置。' },
	{ path: '/login', title: '登录页面', desc: '认证入口雏形。' }
]
</script>
