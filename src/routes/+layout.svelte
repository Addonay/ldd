<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';

	let { children } = $props();

	onMount(() => {
		// Default to dark mode
		if (!document.documentElement.classList.contains('dark')) {
			document.documentElement.classList.add('dark');
		}
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<div class="dark">
	{@render children()}
</div>
