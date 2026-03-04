<script lang="ts">
	import { tick } from 'svelte';
	import { useAppState, formatFloat } from '$lib/stores/app-state.svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import QosSidebar from './qos-sidebar.svelte';
	import KpiGroup from './kpi-group.svelte';
	import ChartFocusModal from './chart-focus-modal.svelte';
	import SettingsDialog from './settings-dialog.svelte';
	import ThresholdDialog from './threshold-dialog.svelte';
	import GroupDialog from './group-dialog.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import ModeToggle from '$lib/components/mode-toggle.svelte';
	import { toast } from 'svelte-sonner';
	import {
		MapPin,
		Calendar,
		ChevronLeft,
		CheckCircle,
		XCircle,
		HelpCircle,
		Loader2
	} from '@lucide/svelte';

	const appState = useAppState();
	const stats = $derived(appState.getStats());

	type KpiStatusFilter = 'all' | 'passing' | 'failing' | 'noThreshold';
	let statusFilter = $state<KpiStatusFilter>('all');
	let generatingCharts = $state(false);
	let generatingImageCharts = $state(false);
	const chartExporters = new Map<string, () => Promise<Blob | null>>();

	function toggleFilter(filter: Exclude<KpiStatusFilter, 'all'>) {
		statusFilter = statusFilter === filter ? 'all' : filter;
	}

	const baseKpiNames = $derived.by(() => {
		if (!appState.selectedGroupId) return appState.kpiNames;
		const group = appState.kpiGroups.find((g) => g.id === appState.selectedGroupId);
		return group ? group.kpiNames : appState.kpiNames;
	});

	const filteredKpiNames = $derived.by(() => {
		if (statusFilter === 'all') return baseKpiNames;

		return baseKpiNames.filter((name) => {
			const latest = appState.getLatestValue(name);
			const result = latest === null ? null : appState.meetsThreshold(name, latest);

			if (statusFilter === 'passing') return result === true;
			if (statusFilter === 'failing') return result === false;
			return result === null;
		});
	});

	const filteredSectionTitle = $derived.by(() => {
		const selectedGroup = appState.kpiGroups.find((g) => g.id === appState.selectedGroupId);
		const groupLabel = selectedGroup ? ` - ${selectedGroup.name}` : '';

		switch (statusFilter) {
			case 'passing':
				return `Passing KPIs${groupLabel}`;
			case 'failing':
				return `Failing KPIs${groupLabel}`;
			case 'noThreshold':
				return `KPIs Without Threshold${groupLabel}`;
			default:
				return selectedGroup?.name ?? 'All KPIs';
		}
	});

	const visibleGroups = $derived.by(() => {
		if (!appState.selectedGroupId) return appState.kpiGroups;
		return appState.kpiGroups.filter((g) => g.id === appState.selectedGroupId);
	});

	const visibleGroupedKpis = $derived.by(() => {
		const set = new Set<string>();
		for (const group of visibleGroups) {
			for (const name of group.kpiNames) set.add(name);
		}
		return set;
	});

	const visibleUngroupedKpis = $derived.by(() => {
		if (appState.selectedGroupId) return [];
		return appState.kpiNames.filter((name) => !visibleGroupedKpis.has(name));
	});

	async function generateExcelCharts() {
		if (generatingCharts) return;
		generatingCharts = true;
		try {
			const exportDays = appState.globalDays;
			const cutoff = new Date();
			cutoff.setHours(0, 0, 0, 0);
			cutoff.setDate(cutoff.getDate() - exportDays);

			const areas = Array.from(appState.data.values()).map((area) => ({
				name: area.name,
				kpis: area.kpis.map((kpi) => ({
					name: kpi.name,
					values: kpi.values
						.filter((point) => point.date >= cutoff)
						.sort((a, b) => a.date.getTime() - b.date.getTime())
						.map((point) => ({
							date: point.date.toISOString(),
							value: point.value
						}))
				}))
			}));

			const thresholds = Object.fromEntries(Array.from(appState.thresholds.entries()));

			const response = await fetch('/api/reports/generate-charts', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					areas,
					thresholds,
					sourceReportFile: appState.sourceReportFile
				})
			});

			const data = await response.json();
			if (!response.ok) {
				throw new Error(data?.error ?? 'Failed to generate charts workbook');
			}

			toast.success('Excel charts generated. Downloading file...');
			window.open(data.url, '_blank');
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to generate charts workbook');
		} finally {
			generatingCharts = false;
		}
	}

	function registerChartExporter(kpiName: string, exporter: (() => Promise<Blob | null>) | null) {
		if (exporter) {
			chartExporters.set(kpiName, exporter);
		} else {
			chartExporters.delete(kpiName);
		}
	}

	async function blobToBase64(blob: Blob): Promise<string> {
		return await new Promise<string>((resolve, reject) => {
			const reader = new FileReader();
			reader.onloadend = () => {
				const result = reader.result;
				if (typeof result !== 'string') {
					reject(new Error('Failed to encode chart image'));
					return;
				}
				resolve(result.split(',')[1] ?? '');
			};
			reader.onerror = () => reject(new Error('Failed to read chart image'));
			reader.readAsDataURL(blob);
		});
	}

	async function generateExcelChartsImages() {
		if (generatingImageCharts) return;
		generatingImageCharts = true;

		try {
			const exportDays = appState.globalDays;
			const cutoff = new Date();
			cutoff.setHours(0, 0, 0, 0);
			cutoff.setDate(cutoff.getDate() - exportDays);

			const originalArea = appState.selectedArea;
			const areaNames = appState.areaNames.length > 0 ? appState.areaNames : Array.from(appState.data.keys());
			const areas: Array<{
				name: string;
				charts: Array<{
					kpiName: string;
					title: string;
					thresholdText: string;
					imageBase64: string;
				}>;
			}> = [];

			try {
				for (const areaName of areaNames) {
					appState.selectedArea = areaName;
					await tick();
					await tick();

					const area = appState.data.get(areaName);
					if (!area) continue;

					const visibleNames = statusFilter === 'all' ? baseKpiNames : filteredKpiNames;
					const visibleSet = new Set(visibleNames);

					const failingKpis: Array<{
						name: string;
						threshold: { operator: string; value: number };
					}> = [];

					for (const kpi of area.kpis) {
						if (!visibleSet.has(kpi.name)) continue;

						const threshold = appState.thresholds.get(kpi.name);
						if (!threshold) continue;

						const points = kpi.values
							.filter((point) => point.date >= cutoff)
							.slice()
							.sort((a, b) => a.date.getTime() - b.date.getTime());
						if (points.length === 0) continue;

						const latest = points[points.length - 1]?.value;
						if (typeof latest !== 'number') continue;

						const passing = appState.meetsThreshold(kpi.name, latest);
						if (passing !== false) continue;

						failingKpis.push({
							name: kpi.name,
							threshold: { operator: threshold.operator, value: threshold.value }
						});
					}

					const charts: Array<{
						kpiName: string;
						title: string;
						thresholdText: string;
						imageBase64: string;
					}> = [];

					for (const item of failingKpis) {
						const exporter = chartExporters.get(item.name);
						if (!exporter) continue;

						const blob = await exporter();
						if (!blob) continue;

						charts.push({
							kpiName: item.name,
							title: appState.getThresholdLabel(item.name),
							thresholdText: `${item.threshold.operator} ${formatFloat(item.threshold.value)}`,
							imageBase64: await blobToBase64(blob)
						});
					}

					if (charts.length > 0) {
						areas.push({ name: area.name, charts });
					}
				}
			} finally {
				appState.selectedArea = originalArea;
				await tick();
			}

			if (areas.length === 0) {
				throw new Error('No chart images available across areas for current filters.');
			}

			const response = await fetch('/api/reports/generate-image-charts', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					days: exportDays,
					sourceReportFile: appState.sourceReportFile,
					areas
				})
			});

			const data = await response.json();
			if (!response.ok) {
				throw new Error(data?.error ?? 'Failed to generate image charts workbook');
			}

			toast.success('Excel 2 generated. Downloading file...');
			window.open(data.url, '_blank');
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to generate image charts workbook');
		} finally {
			generatingImageCharts = false;
		}
	}
</script>

<Sidebar.SidebarProvider bind:open={appState.sidebarOpen}>
	<QosSidebar />

	<Sidebar.SidebarInset>
		<!-- Top bar -->
		<header
			class="flex h-12 items-center justify-between border-b border-border bg-background px-4"
		>
			<div class="flex items-center gap-2">
				<Sidebar.SidebarTrigger class="-ml-1" />
				<div class="flex items-center gap-1.5 text-sm text-foreground">
					<MapPin class="h-3.5 w-3.5 text-primary" />
					<span class="font-medium">{appState.selectedArea}</span>
				</div>
			</div>

			<div class="flex items-center gap-3">
				<!-- Stats summary -->
				<div class="hidden items-center gap-3 text-[10px] md:flex">
					<button
						class="flex items-center gap-1 rounded-sm px-1 py-0.5 transition-colors {statusFilter ===
						'passing'
							? 'bg-green-500/15 text-green-500'
							: 'text-green-500 hover:bg-accent'}"
						onclick={() => toggleFilter('passing')}
						title="Show passing KPIs"
					>
						<CheckCircle class="h-3 w-3" />
						{stats.passing}
					</button>
					<button
						class="flex items-center gap-1 rounded-sm px-1 py-0.5 transition-colors {statusFilter ===
						'failing'
							? 'bg-destructive/15 text-destructive'
							: 'text-destructive hover:bg-accent'}"
						onclick={() => toggleFilter('failing')}
						title="Show failing KPIs"
					>
						<XCircle class="h-3 w-3" />
						{stats.failing}
					</button>
					<button
						class="flex items-center gap-1 rounded-sm px-1 py-0.5 transition-colors {statusFilter ===
						'noThreshold'
							? 'bg-muted text-foreground'
							: 'text-muted-foreground hover:bg-accent hover:text-foreground'}"
						onclick={() => toggleFilter('noThreshold')}
						title="Show KPIs without thresholds"
					>
						<HelpCircle class="h-3 w-3" />
						{stats.noThreshold}
					</button>
				</div>

				<div class="flex items-center gap-2 text-xs text-muted-foreground">
					<Calendar class="h-3.5 w-3.5" />
					<span>Last {appState.globalDays} days</span>
				</div>
				<div class="flex items-center gap-1">
					{#each [7, 14, 30, 60, 90, 180] as d}
						<button
							class="rounded-sm px-1.5 py-0.5 text-[10px] transition-colors {appState.globalDays ===
							d
								? 'bg-primary text-primary-foreground'
								: 'text-muted-foreground hover:bg-accent hover:text-foreground'}"
							onclick={() => (appState.globalDays = d)}
						>
							{d}d
						</button>
					{/each}
				</div>
				<Button
					variant="outline"
					size="sm"
					class="h-7 text-xs"
					onclick={generateExcelCharts}
					disabled={generatingCharts || generatingImageCharts || appState.data.size === 0}
				>
					{#if generatingCharts}
						<Loader2 class="mr-1 h-3 w-3 animate-spin" />
					{:else}
						<span class="mr-1">📈</span>
					{/if}
					Excel Charts
				</Button>
				<Button
					variant="outline"
					size="sm"
					class="h-7 text-xs"
					onclick={generateExcelChartsImages}
					disabled={generatingCharts || generatingImageCharts || appState.data.size === 0}
				>
					{#if generatingImageCharts}
						<Loader2 class="mr-1 h-3 w-3 animate-spin" />
					{:else}
						<span class="mr-1">🖼️</span>
					{/if}
					Excel 2
				</Button>
				<Button
					variant="outline"
					size="sm"
					class="h-7 text-xs"
					onclick={() => {
						appState.view = 'thresholds';
					}}
				>
					<ChevronLeft class="mr-1 h-3 w-3" />
					Thresholds
				</Button>
				<ModeToggle />
			</div>
		</header>

		<!-- Summary stats bar -->
		<div class="flex items-center gap-2 border-b border-border/50 bg-card/50 px-4 py-1.5 md:hidden">
			<button
				class="flex items-center gap-1 rounded-sm px-1 py-0.5 text-[10px] transition-colors {statusFilter ===
				'passing'
					? 'bg-green-500/15 text-green-500'
					: 'text-green-500'}"
				onclick={() => toggleFilter('passing')}
			>
				<CheckCircle class="h-3 w-3" />
				{stats.passing} passing
			</button>
			<button
				class="flex items-center gap-1 rounded-sm px-1 py-0.5 text-[10px] transition-colors {statusFilter ===
				'failing'
					? 'bg-destructive/15 text-destructive'
					: 'text-destructive'}"
				onclick={() => toggleFilter('failing')}
			>
				<XCircle class="h-3 w-3" />
				{stats.failing} failing
			</button>
			<button
				class="flex items-center gap-1 rounded-sm px-1 py-0.5 text-[10px] transition-colors {statusFilter ===
				'noThreshold'
					? 'bg-muted text-foreground'
					: 'text-muted-foreground'}"
				onclick={() => toggleFilter('noThreshold')}
			>
				<HelpCircle class="h-3 w-3" />
				{stats.noThreshold} no threshold
			</button>
		</div>

		<!-- Main content -->
		<main class="flex-1 overflow-y-auto p-4">
			{#if appState.data.size === 0}
				<div class="flex h-full items-center justify-center">
					<p class="text-sm text-muted-foreground">No data loaded</p>
				</div>
			{:else}
				{#if statusFilter !== 'all'}
					{#if filteredKpiNames.length > 0}
						<KpiGroup
							groupName={filteredSectionTitle}
							kpiNames={filteredKpiNames}
							onRegisterExporter={registerChartExporter}
						/>
					{:else}
						<div class="flex h-32 items-center justify-center rounded-sm border border-border bg-card/40">
							<p class="text-sm text-muted-foreground">No KPIs match this filter</p>
						</div>
					{/if}
				{:else}
					<!-- Original grouped layout -->
					{#each visibleGroups as group (group.id)}
						<KpiGroup
							groupName={group.name}
							kpiNames={group.kpiNames}
							onRegisterExporter={registerChartExporter}
						/>
					{/each}

					{#if visibleUngroupedKpis.length > 0}
						<KpiGroup
							groupName={visibleGroups.length > 0 ? 'Other KPIs' : 'All KPIs'}
							kpiNames={visibleUngroupedKpis}
							onRegisterExporter={registerChartExporter}
						/>
					{:else if visibleGroups.length === 0}
						<div class="flex h-32 items-center justify-center rounded-sm border border-border bg-card/40">
							<p class="text-sm text-muted-foreground">No KPIs available</p>
						</div>
					{/if}
				{/if}
			{/if}
		</main>
	</Sidebar.SidebarInset>

	<!-- Dialogs -->
	<SettingsDialog />
	<ThresholdDialog />
	<GroupDialog />
</Sidebar.SidebarProvider>

<!-- Focus modal (rendered outside sidebar provider for z-index) -->
<ChartFocusModal />
