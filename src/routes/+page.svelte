<script lang="ts">
	import { setAppState } from '$lib/stores/app-state.svelte';
	import SplashScreen from '$lib/components/app/splash-screen.svelte';
	import ThresholdConfig from '$lib/components/app/threshold-config.svelte';
	import GroupConfig from '$lib/components/app/group-config.svelte';
	import Dashboard from '$lib/components/app/dashboard.svelte';
	import { Toaster } from '$lib/components/ui/sonner/index.js';

	const appState = setAppState();
</script>

<Toaster richColors position="top-right" />

{#if appState.view === 'splash'}
	<SplashScreen />
{:else if appState.view === 'thresholds'}
	<ThresholdConfig />
{:else if appState.view === 'grouping'}
	<GroupConfig />
{:else if appState.view === 'dashboard'}
	<Dashboard />
{/if}
