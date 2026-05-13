/**
 * 确认→执行→反馈 通用封装
 *
 * 用法：
 *   const { execute, loading } = useConfirmAction()
 *   await execute({
 *     confirmText: '确认删除？',
 *     confirmType: 'error',
 *     action: async () => apiDelete(id),
 *     successMsg: '删除成功',
 *   })
 */

interface ExecuteOptions {
	confirmText: string
	confirmTitle?: string
	confirmType?: 'warning' | 'error' | 'info'
	confirmButtonText?: string
	danger?: boolean
	action: () => Promise<unknown>
	successMsg: string
	errorMsg?: string
	onSuccess?: () => void
}

export function useConfirmAction() {
	const loading = ref(false)

	async function execute(opts: ExecuteOptions): Promise<boolean> {
		const confirmed = await msgConfirm(
			opts.confirmText,
			opts.confirmTitle ?? '操作确认',
			{
				type: opts.confirmType ?? 'warning',
				confirmText: opts.confirmButtonText,
				danger: opts.danger,
			},
		)
		if (!confirmed) return false

		loading.value = true
		try {
			await opts.action()
			msgSuccess(opts.successMsg)
			opts.onSuccess?.()
			return true
		} catch (err: unknown) {
			const apiMsg =
				err && typeof err === 'object' && 'data' in err
					? (err as { data?: { message?: string } }).data?.message
					: undefined
			msgError(apiMsg || opts.errorMsg || '操作失败')
			return false
		} finally {
			loading.value = false
		}
	}

	return { execute, loading }
}
