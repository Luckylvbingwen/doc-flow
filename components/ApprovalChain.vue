<template>
	<div class="df-approval-chain" :class="{
		'df-approval-chain--compact': compact,
		'df-approval-chain--vertical': direction === 'vertical',
	}" role="list" :aria-label="ariaLabel">
		<!-- 起始节点 -->
		<div v-if="showEndpoints" class="df-chain-node df-chain-node--endpoint" role="listitem">
			<div class="df-chain-node__icon df-chain-node__icon--start">
				<el-icon :size="compact ? 14 : 16">
					<Upload />
				</el-icon>
			</div>
			<span class="df-chain-node__label">提交人上传</span>
		</div>

		<span v-if="showEndpoints && nodes.length > 0" class="df-chain-arrow">
			<el-icon>
				<ArrowRight />
			</el-icon>
		</span>

		<!-- 审批人节点 -->
		<template v-for="(node, index) in nodes" :key="index">
			<div class="df-chain-node" :class="nodeClass(node)" role="listitem"
				:aria-current="node.status === 'current' ? 'step' : undefined">
				<div class="df-chain-node__avatar" :style="avatarStyle(node)">
					<template v-if="node.status === 'approved'">
						<el-icon>
							<Check />
						</el-icon>
					</template>
					<template v-else-if="node.status === 'rejected'">
						<el-icon>
							<Close />
						</el-icon>
					</template>
					<template v-else>
						{{ node.avatar || (node.name ? node.name[0] : '') }}
					</template>
				</div>
				<div class="df-chain-node__info">
					<span class="df-chain-node__name">{{ node.name }}</span>
					<span v-if="node.statusText" class="df-chain-node__status">
						{{ node.statusText }}
					</span>
				</div>
			</div>

			<span v-if="index < nodes.length - 1 || showEndpoints" class="df-chain-arrow"
				:class="{ 'df-chain-arrow--done': node.status === 'approved' }">
				<el-icon>
					<ArrowRight />
				</el-icon>
			</span>
		</template>

		<!-- 结束节点 -->
		<div v-if="showEndpoints" class="df-chain-node df-chain-node--endpoint df-chain-node--end"
			:class="{ 'df-chain-node--completed': allApproved }" role="listitem">
			<div class="df-chain-node__icon df-chain-node__icon--end">
				<el-icon :size="compact ? 14 : 16">
					<SuccessFilled v-if="allApproved" />
					<Flag v-else />
				</el-icon>
			</div>
			<span class="df-chain-node__label">{{ allApproved ? '已发布' : '发布' }}</span>
		</div>
	</div>
</template>

<script setup lang="ts">
import {
	Upload,
	ArrowRight,
	Check,
	Close,
	SuccessFilled,
	Flag,
} from '@element-plus/icons-vue'

export interface ChainNode {
	/** 审批人姓名 */
	name: string
	/** 头像文字（默认取 name 首字） */
	avatar?: string
	/** 头像背景色 */
	color?: string
	/** 节点状态 */
	status?: 'approved' | 'current' | 'rejected' | 'waiting'
	/** 状态辅助文字（如"审批中"） */
	statusText?: string
}

const props = withDefaults(
	defineProps<{
		/** 节点数组 */
		nodes: ChainNode[]
		/** 是否显示首尾端点（提交→发布） */
		showEndpoints?: boolean
		/** 紧凑模式 */
		compact?: boolean
		/** 布局方向 */
		direction?: 'horizontal' | 'vertical'
		/** 无障碍标签 */
		ariaLabel?: string
	}>(),
	{
		showEndpoints: false,
		compact: false,
		direction: 'horizontal',
		ariaLabel: '审批流程',
	}
)

const allApproved = computed(() =>
	props.nodes.length > 0 && props.nodes.every((n) => n.status === 'approved')
)

function nodeClass(node: ChainNode) {
	return {
		'df-chain-node--approved': node.status === 'approved',
		'df-chain-node--current': node.status === 'current',
		'df-chain-node--rejected': node.status === 'rejected',
		'df-chain-node--waiting': node.status === 'waiting' || !node.status,
	}
}

function avatarStyle(node: ChainNode) {
	if (node.status === 'approved') return {}
	if (node.status === 'rejected') return {}
	if (node.status === 'current') return {}
	if (node.color) return { background: node.color }
	return {}
}
</script>
