<template>
	<div class="editor-layout">
		<slot />
	</div>
</template>

<style>
.editor-layout {
	display: flex;
	flex-direction: column;
	height: 100vh;
	overflow: hidden;
	background: var(--df-panel);
}
</style>
