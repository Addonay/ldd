<script lang="ts">
	import { useAppState, vtName } from '$lib/stores/app-state.svelte';
	import KpiChart from './kpi-chart.svelte';
	import AddKpiDialog from './add-kpi-dialog.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { X, Plus, Copy, Calendar } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';

	const appState = useAppState();

	let focusDays = $state(30);
	let addDialogOpen = $state(false);

	// Additional KPIs overlaid on the focused chart
	let overlayKpis = $state<string[]>([]);

	const DAY_OPTIONS = [7, 14, 30, 60, 90, 180];

	function close() {
		overlayKpis = [];
		focusDays = 30;
		appState.closeFocusedChart();
	}

	function handleBackdropClick(e: MouseEvent) {
		if ((e.target as HTMLElement)?.classList.contains('focus-modal-backdrop')) {
			close();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') close();
	}

	function addOverlayKpi(name: string) {
		if (!overlayKpis.includes(name)) {
			overlayKpis = [...overlayKpis, name];
		}
		addDialogOpen = false;
	}

	function removeOverlayKpi(name: string) {
		overlayKpis = overlayKpis.filter((k) => k !== name);
	}

	async function copyChart() {
		// Find the canvas inside our modal content
		const canvas = document.querySelector('.focus-modal-chart canvas') as HTMLCanvasElement;
		if (!canvas) return;

		try {
			const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
			if (blob) {
				await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
				toast.success('Chart copied to clipboard');
			}
		} catch {
			toast.error('Failed to copy chart');
		}
	}

	const transitionName = $derived(appState.focusedChart ? vtName(appState.focusedChart) : 'none');
</script>

<svelte:window onkeydown={handleKeydown} />

{#if appState.focusedChart}
	{@const kpiName = appState.focusedChart}

	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="focus-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-8"
		style="backdrop-filter: blur(12px); background: oklch(0.1 0.02 220 / 0.7);"
		onclick={handleBackdropClick}
	>
		<!-- Modal content -->
		<div
			class="focus-modal-content relative flex w-full max-w-6xl flex-col rounded-sm border border-border bg-card shadow-2xl"
			style="view-transition-name: {transitionName}; max-height: 90vh;"
		>
			<!-- Header -->
			<div class="flex items-center justify-between border-b border-border px-4 py-3">
				<h2 class="text-sm font-bold tracking-wider text-foreground uppercase">
					{kpiName}
				</h2>

				<div class="flex items-center gap-2">
					<!-- Date range buttons -->
					<div class="flex items-center gap-1">
						<Calendar class="mr-1 h-3.5 w-3.5 text-muted-foreground" />
						{#each DAY_OPTIONS as d}
							<button
								class="rounded-sm px-1.5 py-0.5 text-[10px] transition-colors {focusDays === d
									? 'bg-primary text-primary-foreground'
									: 'text-muted-foreground hover:bg-accent hover:text-foreground'}"
								onclick={() => (focusDays = d)}
							>
								{d}d
							</button>
						{/each}
					</div>

					<!-- Add overlay -->
					<Button
						variant="ghost"
						size="sm"
						class="h-7 text-xs"
						onclick={() => (addDialogOpen = true)}
					>
						<Plus class="mr-1 h-3.5 w-3.5" />
						Overlay
					</Button>

					<!-- Copy -->
					<Button variant="ghost" size="sm" class="h-7 text-xs" onclick={copyChart}>
						<Copy class="mr-1 h-3.5 w-3.5" />
						Copy
					</Button>

					<!-- Close -->
					<button
						onclick={close}
						class="flex h-7 w-7 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
					>
						<X class="h-4 w-4" />
					</button>
				</div>
			</div>

			<!-- Overlay KPI badges -->
			{#if overlayKpis.length > 0}
				<div class="flex flex-wrap items-center gap-1.5 border-b border-border/50 px-4 py-2">
					<span class="text-[10px] text-muted-foreground">Overlays:</span>
					{#each overlayKpis as extra}
						<button
							onclick={() => removeOverlayKpi(extra)}
							class="flex items-center gap-1 rounded-sm bg-accent px-1.5 py-0.5 text-[10px] text-accent-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
						>
							{extra}
							<X class="h-2.5 w-2.5" />
						</button>
					{/each}
				</div>
			{/if}

			<!-- Large chart -->
			<div class="focus-modal-chart flex flex-1 flex-col p-1" style="min-height: 600px;">
				<KpiChart
					{kpiName}
					additionalKpis={overlayKpis}
					showToolbar={false}
					daysOverride={focusDays}
					fillHeight={true}
				/>
			</div>
		</div>
	</div>

	<!-- Add KPI dialog for overlays -->
	<AddKpiDialog
		bind:open={addDialogOpen}
		primaryKpi={kpiName}
		currentOverlays={overlayKpis}
		onClose={() => (addDialogOpen = false)}
		onAdd={addOverlayKpi}
	/>
{/if}
