import { describe, it, expect } from 'vitest'
import { buildDeptTree, parseFeishuDeptIds } from '~/server/utils/user-tree'
import type { UserTreeDeptRow, UserTreeUserRow } from '~/server/types/group-member'

describe('parseFeishuDeptIds', () => {
	it('原样返回数组', () => {
		expect(parseFeishuDeptIds(['d1', 'd2'])).toEqual(['d1', 'd2'])
	})

	it('解析 JSON 字符串', () => {
		expect(parseFeishuDeptIds('["d1","d2"]')).toEqual(['d1', 'd2'])
	})

	it('空字符串返回空数组', () => {
		expect(parseFeishuDeptIds('')).toEqual([])
	})

	it('非法 JSON 返回空数组', () => {
		expect(parseFeishuDeptIds('not-json')).toEqual([])
	})

	it('null / undefined 返回空数组', () => {
		expect(parseFeishuDeptIds(null)).toEqual([])
		expect(parseFeishuDeptIds(undefined)).toEqual([])
	})
})

describe('buildDeptTree', () => {
	const depts: UserTreeDeptRow[] = [
		{ id: 1, name: '研发中心', feishu_department_id: 'fd-rd' },
		{ id: 2, name: '质量保障部', feishu_department_id: 'fd-qa' },
	]

	it('用户归入其所属的多个部门', () => {
		const users: UserTreeUserRow[] = [
			{
				user_id: 100,
				name: '张三',
				email: 'z@example.com',
				avatar_url: null,
				feishu_department_ids: ['fd-rd', 'fd-qa'],
			},
		]

		const tree = buildDeptTree(depts, users, new Set())

		expect(tree).toHaveLength(2)
		expect(tree[0].members).toHaveLength(1)
		expect(tree[1].members).toHaveLength(1)
		expect(tree[0].members[0].id).toBe(100)
		expect(tree[0].memberCount).toBe(1)
	})

	it('未关联任何部门的用户不出现', () => {
		const users: UserTreeUserRow[] = [
			{
				user_id: 100,
				name: '张三',
				email: null,
				avatar_url: null,
				feishu_department_ids: null,
			},
		]

		const tree = buildDeptTree(depts, users, new Set())
		expect(tree.every((d) => d.members.length === 0)).toBe(true)
	})

	it('feishu_department_id 为空的部门得到空成员列表', () => {
		const dSpecial: UserTreeDeptRow[] = [
			{ id: 99, name: '未同步部门', feishu_department_id: null },
		]
		const users: UserTreeUserRow[] = [
			{
				user_id: 1,
				name: 'x',
				email: null,
				avatar_url: null,
				feishu_department_ids: ['fd-xxx'],
			},
		]

		const tree = buildDeptTree(dSpecial, users, new Set())
		expect(tree).toHaveLength(1)
		expect(tree[0].memberCount).toBe(0)
	})

	it('joinedUserIds 标记已加入的用户', () => {
		const users: UserTreeUserRow[] = [
			{
				user_id: 100,
				name: '张三',
				email: null,
				avatar_url: null,
				feishu_department_ids: ['fd-rd'],
			},
			{
				user_id: 200,
				name: '李四',
				email: null,
				avatar_url: null,
				feishu_department_ids: ['fd-rd'],
			},
		]

		const tree = buildDeptTree(depts, users, new Set([100]))

		const rd = tree.find((d) => d.id === 1)!
		const zhang = rd.members.find((m) => m.id === 100)!
		const li = rd.members.find((m) => m.id === 200)!
		expect(zhang.joined).toBe(true)
		expect(li.joined).toBe(false)
	})

	it('支持字符串形式的 feishu_department_ids（兼容 Prisma JSON 列）', () => {
		const users: UserTreeUserRow[] = [
			{
				user_id: 100,
				name: '张三',
				email: null,
				avatar_url: null,
				feishu_department_ids: '["fd-rd"]',
			},
		]

		const tree = buildDeptTree(depts, users, new Set())
		expect(tree.find((d) => d.id === 1)?.members).toHaveLength(1)
	})

	it('BigInt user_id 正确转换为 Number', () => {
		const users: UserTreeUserRow[] = [
			{
				user_id: 100n,
				name: '张三',
				email: null,
				avatar_url: null,
				feishu_department_ids: ['fd-rd'],
			},
		]

		const tree = buildDeptTree(depts, users, new Set([100]))
		expect(tree[0].members[0].id).toBe(100)
		expect(tree[0].members[0].joined).toBe(true)
	})

	it('保持部门原顺序', () => {
		const users: UserTreeUserRow[] = []
		const tree = buildDeptTree(depts, users, new Set())
		expect(tree.map((d) => d.id)).toEqual([1, 2])
	})

	it('空输入返回空数组', () => {
		expect(buildDeptTree([], [], new Set())).toEqual([])
	})
})
