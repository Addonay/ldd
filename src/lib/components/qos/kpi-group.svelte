<script lang="ts">
	import { useAppState } from '$lib/stores/app-state.svelte';
	import KpiChart from './kpi-chart.svelte';
	import AddKpiDialog from './add-kpi-dialog.svelte';

	interface Props {
		groupName: string;
		kpiNames: string[];
		onRegisterExporter?: (kpiName: string, exporter: (() => Promise<Blob | null>) | null) => void;
	}

	let { groupName, kpiNames, onRegisterExporter }: Props = $props();

	const appState = useAppState();

	// Track which chart's add-KPI dialog is open
	let addDialogKpi = $state<string | null>(null);
	let addDialogOpen = $state(false);

	function openAddDialog(kpiName: string) {
		addDialogKpi = kpiName;
		addDialogOpen = true;
	}

	function handleAdd(kpiName: string) {
		if (addDialogKpi) {
			appState.addOverlay(addDialogKpi, kpiName);
		}
		addDialogOpen = false;
		addDialogKpi = null;
	}

	function handleRemove(primaryKpi: string, overlayKpi: string) {
		appState.removeOverlay(primaryKpi, overlayKpi);
	}

	function handleChartClick(kpiName: string) {
		appState.openFocusedChart(kpiName);
	}
</script>

<!-- Group header -->
<div class="mt-6 mb-3 first:mt-0">
	<h2 class="text-sm font-bold tracking-wider text-foreground uppercase">
		{groupName}
	</h2>
	<div class="mt-1 h-px w-full bg-border"></div>
</div>

<!-- Chart grid: 3 per row with stagger animation -->
<div class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
	{#each kpiNames as kpiName, i (kpiName)}
		{@const overlays = appState.chartOverlays.get(kpiName) ?? []}
		<div
			class="animate-in fade-in-0 slide-in-from-bottom-2"
			style="--stagger-delay: {i * 50}ms; animation-delay: var(--stagger-delay);"
		>
			<KpiChart
				{kpiName}
				additionalKpis={overlays}
				onAddKpi={() => openAddDialog(kpiName)}
				onRemoveKpi={(name) => handleRemove(kpiName, name)}
				onChartClick={() => handleChartClick(kpiName)}
				onRegisterExporter={onRegisterExporter}
			/>
		</div>
	{/each}
</div>

<!-- Add KPI Dialog -->
{#if addDialogKpi}
	<AddKpiDialog
		bind:open={addDialogOpen}
		primaryKpi={addDialogKpi}
		currentOverlays={appState.chartOverlays.get(addDialogKpi) ?? []}
		onClose={() => {
			addDialogOpen = false;
			addDialogKpi = null;
		}}
		onAdd={handleAdd}
	/>
{/if}
