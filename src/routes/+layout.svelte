<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import { ModeWatcher } from 'mode-watcher';

	let { children } = $props();

</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<div >
	<ModeWatcher defaultMode="system"/>
	{@render children()}
</div>
