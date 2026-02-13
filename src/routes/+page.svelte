<script lang="ts">
	import { onMount } from 'svelte';
	import { env } from '$env/dynamic/public';
	import { setAppState } from '$lib/stores/app-state.svelte';
	import SplashScreen from '$lib/components/app/splash-screen.svelte';
	import FilePicker from '$lib/components/app/file-picker.svelte';
	import ThresholdConfig from '$lib/components/app/threshold-config.svelte';
	import GroupConfig from '$lib/components/app/group-config.svelte';
	import Dashboard from '$lib/components/app/dashboard.svelte';
	import { Toaster } from '$lib/components/ui/sonner/index.js';

	const appState = setAppState();

	let availableReports = $state<string[]>([]);
	let showFilePicker = $state(false);
	let loading = $state(true);
	const uploadsDisabled = env.PUBLIC_DISABLE_UPLOAD === 'true';

	onMount(async () => {
		// Check for available reports in static/reports/
		try {
			const response = await fetch('/api/reports');
			if (response.ok) {
				const data = await response.json();
				availableReports = data.files || [];
				showFilePicker = uploadsDisabled || availableReports.length > 0;
			}
		} catch (err) {
			console.log('Failed to fetch reports list:', err);
			showFilePicker = uploadsDisabled;
		} finally {
			loading = false;
		}
	});

	function handleManualUpload() {
		if (uploadsDisabled) return;
		showFilePicker = false;
	}
</script>

<Toaster richColors position="top-right" />

{#if !loading}
	{#if appState.view === 'splash'}
		{#if showFilePicker}
			<FilePicker
				files={availableReports}
				onManualUpload={handleManualUpload}
				allowManualUpload={!uploadsDisabled}
			/>
		{:else}
			<SplashScreen />
		{/if}
	{:else if appState.view === 'thresholds'}
		<ThresholdConfig />
	{:else if appState.view === 'grouping'}
		<GroupConfig />
	{:else if appState.view === 'dashboard'}
		<Dashboard />
	{/if}
{/if}
