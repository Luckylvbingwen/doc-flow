<template>
	<div class="df-empty-state" :class="{ 'df-empty-state--compact': compact }">
		<img
v-if="resolvedImage" :src="resolvedImage" :alt="resolvedTitle" class="df-empty-state__image"
			:style="{ width: imageWidth + 'px', height: imageWidth + 'px' }">
		<div class="df-empty-state__text">
			<p class="df-empty-state__title">{{ resolvedTitle }}</p>
			<p v-if="resolvedDescription" class="df-empty-state__desc">
				{{ resolvedDescription }}
			</p>
		</div>
		<div v-if="$slots.default" class="df-empty-state__action">
			<slot />
		</div>
	</div>
</template>

<script setup lang="ts">
interface PresetConfig {
	image: string
	title: string
	description?: string
}

const PRESETS: Record<string, PresetConfig> = {
	'no-content': {
		image: '/images/empty/no-content.svg',
		title: '暂无内容',
		description: '创建组开始管理文件',
	},
	'no-files': {
		image: '/images/empty/no-files.svg',
		title: '暂无文件',
		description: '当前目录下还没有文件',
	},
	'no-pending': {
		image: '/images/empty/no-pending.svg',
		title: '暂无待处理的审批',
		description: '所有审批已处理完成',
	},
	'no-completed': {
		image: '/images/empty/no-completed.svg',
		title: '暂无已处理的审批',
	},
	'no-initiated': {
		image: '/images/empty/no-initiated.svg',
		title: '暂无我发起的审批',
	},
	'no-results': {
		image: '/images/empty/no-results.svg',
		title: '没有找到结果',
		description: '换个关键词试试',
	},
	'no-logs': {
		image: '/images/empty/no-logs.svg',
		title: '暂无操作日志',
		description: '暂无匹配的操作记录',
	},
	'no-notifications': {
		image: '/images/empty/no-notifications.svg',
		title: '暂无通知',
		description: '新消息会在这里显示',
	},
	'no-members': {
		image: '/images/empty/no-members.svg',
		title: '暂无成员',
		description: '添加成员以开始协作',
	},
	'no-subgroups': {
		image: '/images/empty/no-subgroups.svg',
		title: '暂无下属组',
	},
	'no-trash': {
		image: '/images/empty/no-trash.svg',
		title: '回收站为空',
		description: '已删除的文件会暂存在这里',
	},
}

const props = withDefaults(
	defineProps<{
		/** 预设场景名称 */
		preset?: string
		/** 自定义标题（覆盖 preset） */
		title?: string
		/** 自定义描述（覆盖 preset） */
		description?: string
		/** 自定义图片路径（覆盖 preset） */
		image?: string
		/** 图片宽高，默认 180（compact 模式 120） */
		imageSize?: number
		/** 紧凑模式，用于表格/列表内嵌 */
		compact?: boolean
	}>(),
	{
		preset: undefined,
		title: undefined,
		description: undefined,
		image: undefined,
		imageSize: undefined,
		compact: false,
	}
)

const presetConfig = computed(() => {
	if (props.preset && PRESETS[props.preset]) {
		return PRESETS[props.preset]
	}
	return null
})

const resolvedImage = computed(
	() => props.image ?? presetConfig.value?.image
)

const resolvedTitle = computed(
	() => props.title ?? presetConfig.value?.title ?? '暂无数据'
)

const resolvedDescription = computed(
	() => props.description ?? presetConfig.value?.description
)

const imageWidth = computed(() => {
	if (props.imageSize) return props.imageSize
	return props.compact ? 120 : 180
})
</script>
