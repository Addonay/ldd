<script lang="ts">
	import { Upload, Link, Loader2, FileSpreadsheet } from '@lucide/svelte';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { useAppState, type AreaData } from '$lib/stores/app-state.svelte';
	import { parseExcelBuffer, fetchExcelFromUrl } from '$lib/utils/excel-parser';
	import { getDefaultThreshold } from '$lib/utils/default-thresholds';
	import { toast } from 'svelte-sonner';
	import { SvelteMap } from 'svelte/reactivity';

	const appState = useAppState();

	let url = $state('');
	let loading = $state(false);
	let dragOver = $state(false);
	let fileInput: HTMLInputElement | undefined = $state();

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

	async function handleFile(file: File) {
		if (!file) return;

		const validTypes = [
			'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			'application/vnd.ms-excel',
			'text/csv'
		];
		const validExtensions = ['.xlsx', '.xls', '.csv'];
		const hasValidExt = validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));

		if (!validTypes.includes(file.type) && !hasValidExt) {
			toast.error('Please upload a valid Excel file (.xlsx, .xls, .csv)');
			return;
		}

		loading = true;
		try {
			const buffer = await file.arrayBuffer();
			const result = parseExcelBuffer(buffer);
			loadData(result);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to parse file');
		} finally {
			loading = false;
		}
	}

	async function handleUrl() {
		if (!url.trim()) {
			toast.error('Please enter a URL');
			return;
		}

		loading = true;
		try {
			const buffer = await fetchExcelFromUrl(url.trim());
			const result = parseExcelBuffer(buffer);
			loadData(result);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to fetch spreadsheet');
		} finally {
			loading = false;
		}
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		const file = e.dataTransfer?.files?.[0];
		if (file) handleFile(file);
	}

	function onDragOver(e: DragEvent) {
		e.preventDefault();
		dragOver = true;
	}

	function onDragLeave() {
		dragOver = false;
	}

	function onFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) handleFile(file);
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') handleUrl();
	}
</script>

<div class="flex min-h-svh items-center justify-center bg-background p-4">
	<div class="w-full max-w-lg space-y-6">
		<!-- Header -->
		<div class="space-y-2 text-center">
			<div class="flex items-center justify-center gap-2">
				<FileSpreadsheet class="h-8 w-8 text-primary" />
				<h1 class="text-2xl font-bold tracking-tight text-foreground">KPI Dashboard</h1>
			</div>
			<p class="text-sm text-muted-foreground">
				Upload a spreadsheet or enter a URL to get started
			</p>
		</div>

		<!-- Upload Card -->
		<Card.Root>
			<Card.Content class="space-y-4 pt-6">
				<!-- Drop zone -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="relative flex min-h-[180px] cursor-pointer flex-col items-center justify-center gap-3 rounded-sm border-2 border-dashed transition-colors {dragOver
						? 'border-primary bg-primary/5'
						: 'border-border hover:border-muted-foreground/50'}"
					ondrop={onDrop}
					ondragover={onDragOver}
					ondragleave={onDragLeave}
					onclick={() => fileInput?.click()}
					role="button"
					tabindex="0"
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') fileInput?.click();
					}}
				>
					{#if loading}
						<Loader2 class="h-10 w-10 animate-spin text-primary" />
						<p class="text-sm text-muted-foreground">Processing...</p>
					{:else}
						<Upload class="h-10 w-10 {dragOver ? 'text-primary' : 'text-muted-foreground'}" />
						<div class="space-y-1 text-center">
							<p class="text-sm font-medium text-foreground">Drop your spreadsheet here</p>
							<p class="text-xs text-muted-foreground">or click to browse</p>
						</div>
						<p class="text-xs text-muted-foreground/60">.xlsx, .xls, .csv</p>
					{/if}

					<input
						bind:this={fileInput}
						type="file"
						accept=".xlsx,.xls,.csv"
						class="hidden"
						onchange={onFileSelect}
					/>
				</div>

				<!-- Divider -->
				<div class="flex items-center gap-3">
					<Separator class="flex-1" />
					<span class="text-xs text-muted-foreground">OR</span>
					<Separator class="flex-1" />
				</div>

				<!-- URL Input -->
				<div class="flex gap-2">
					<div class="relative flex-1">
						<Link class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							bind:value={url}
							placeholder="https://example.com/data.xlsx"
							class="pl-9"
							disabled={loading}
							onkeydown={onKeydown}
						/>
					</div>
					<Button onclick={handleUrl} disabled={loading || !url.trim()} size="default">
						{#if loading}
							<Loader2 class="h-4 w-4 animate-spin" />
						{:else}
							Fetch
						{/if}
					</Button>
				</div>
			</Card.Content>
		</Card.Root>

		<!-- Footer hint -->
		<p class="text-center text-xs text-muted-foreground/60">
			Single sheet with areas separated by empty rows. First area uses the sheet name.
		</p>
	</div>
</div>
