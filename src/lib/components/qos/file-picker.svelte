<script lang="ts">
	import { FileSpreadsheet, Loader2 } from '@lucide/svelte';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { useAppState, type AreaData } from '$lib/stores/app-state.svelte';
	import { parseExcelBuffer } from '$lib/utils/excel-parser';
	import { getDefaultThreshold } from '$lib/utils/default-thresholds';
	import { toast } from 'svelte-sonner';
	import { SvelteMap } from 'svelte/reactivity';

	interface Props {
		files: string[];
		onManualUpload: () => void;
		allowManualUpload?: boolean;
	}

	let { files, onManualUpload, allowManualUpload = true }: Props = $props();

	const appState = useAppState();

	let loading = $state(false);
	let selectedFile = $state('');

	function loadData(result: {
		areas: Map<string, AreaData>;
		kpiNames: string[];
		areaNames: string[];
	}) {
		const { areas, kpiNames, areaNames } = result;

		if (areas.size === 0) {
			toast.error('No valid data found in the spreadsheet.');
			return;
		}

		appState.data = areas;
		appState.kpiNames = kpiNames;
		appState.areaNames = areaNames;
		appState.selectedArea = areaNames[0] ?? '';

		// Initialize default thresholds for new KPIs only (only if default exists)
		const newThresholds = new SvelteMap(appState.thresholds);
		for (const name of kpiNames) {
			if (!newThresholds.has(name)) {
				const defaultThreshold = getDefaultThreshold(name);
				if (defaultThreshold) {
					newThresholds.set(name, defaultThreshold);
				}
			}
		}
		appState.thresholds = newThresholds;

		toast.success(`Loaded ${areas.size} areas with ${kpiNames.length} KPIs`);

		// If saved settings exist, skip straight to dashboard
		if (appState.hasSavedSettings()) {
			appState.saveToStorage();
			toast.info('Loaded saved settings');
			appState.view = 'dashboard';
		} else {
			appState.view = 'thresholds';
		}
	}

	async function handleLoadFile(filename: string) {
		loading = true;
		selectedFile = filename;

		try {
			const response = await fetch(`/reports/${filename}`);
			if (!response.ok) {
				throw new Error('Failed to load file');
			}

			const buffer = await response.arrayBuffer();
			const result = parseExcelBuffer(buffer);
			appState.sourceReportFile = filename;
			loadData(result);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to load file');
		} finally {
			loading = false;
			selectedFile = '';
		}
	}
</script>

<div class="flex min-h-svh items-center justify-center bg-background p-4">
	<div class="w-full max-w-2xl space-y-6">
		<!-- Header -->
		<div class="space-y-2 text-center">
			<div class="flex items-center justify-center gap-2">
				<FileSpreadsheet class="h-8 w-8 text-primary" />
				<h1 class="text-2xl font-bold tracking-tight text-foreground">KPI Dashboard</h1>
			</div>
			<p class="text-sm text-muted-foreground">Select a report to load</p>
		</div>

		<!-- File List Card -->
		<Card.Root>
			<Card.Header>
				<Card.Title>Available Reports</Card.Title>
				<Card.Description>Choose from your collected reports</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-2">
				{#if files.length > 0}
					{#each files as file}
						<button
							class="flex w-full items-center justify-between rounded-md border border-border bg-background px-4 py-3 text-left transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
							disabled={loading}
							onclick={() => handleLoadFile(file)}
						>
							<div class="flex items-center gap-3">
								<FileSpreadsheet class="h-5 w-5 text-muted-foreground" />
								<span class="font-medium">{file}</span>
							</div>
							{#if loading && selectedFile === file}
								<Loader2 class="h-4 w-4 animate-spin text-primary" />
							{/if}
						</button>
					{/each}
				{:else}
					<div class="rounded-md border border-border bg-background px-4 py-6 text-center text-sm text-muted-foreground">
						No approved reports are currently available.
					</div>
				{/if}
			</Card.Content>
			{#if allowManualUpload}
				<Card.Footer>
					<Button variant="outline" class="w-full" onclick={onManualUpload} disabled={loading}>
						Upload Different File
					</Button>
				</Card.Footer>
			{/if}
		</Card.Root>

		<!-- Footer hint -->
		<p class="text-center text-xs text-muted-foreground/60">
			Reports located in static/reports/ directory
		</p>
	</div>
</div>
