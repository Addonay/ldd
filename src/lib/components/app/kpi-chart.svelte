<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import {
		Chart,
		LineController,
		LineElement,
		PointElement,
		LinearScale,
		CategoryScale,
		Tooltip,
		Legend,
		Filler,
		TimeScale
	} from 'chart.js';
	import 'chartjs-adapter-date-fns';
	import annotationPlugin from 'chartjs-plugin-annotation';
	import { useAppState, formatFloat, vtName } from '$lib/stores/app-state.svelte';
	import { Copy, Plus, X } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';

	Chart.register(
		LineController,
		LineElement,
		PointElement,
		LinearScale,
		CategoryScale,
		TimeScale,
		Tooltip,
		Legend,
		Filler,
		annotationPlugin
	);

	interface Props {
		kpiName: string;
		additionalKpis?: string[];
		showToolbar?: boolean;
		daysOverride?: number;
		onAddKpi?: () => void;
		onRemoveKpi?: (name: string) => void;
		onChartClick?: () => void;
		fillHeight?: boolean;
	}

	let {
		kpiName,
		additionalKpis = [],
		showToolbar = true,
		daysOverride,
		onAddKpi,
		onRemoveKpi,
		onChartClick,
		fillHeight = false
	}: Props = $props();

	const appState = useAppState();

	let canvasEl: HTMLCanvasElement | undefined = $state();
	let chartInstance: Chart | null = null;
	let hovered = $state(false);

	// 12+ clearly distinct colors spread across the hue wheel
	const COLORS = [
		'oklch(0.75 0.18 30)', // red-orange
		'oklch(0.72 0.16 145)', // green
		'oklch(0.70 0.18 260)', // blue
		'oklch(0.78 0.15 65)', // amber/yellow
		'oklch(0.68 0.17 310)', // purple/magenta
		'oklch(0.74 0.14 185)', // teal/cyan
		'oklch(0.73 0.16 15)', // red
		'oklch(0.76 0.13 110)', // lime green
		'oklch(0.65 0.18 285)', // indigo
		'oklch(0.80 0.12 80)', // gold
		'oklch(0.70 0.15 340)', // pink
		'oklch(0.72 0.12 210)', // sky blue
		'oklch(0.68 0.14 50)', // brown/orange
		'oklch(0.75 0.16 170)', // emerald
		'oklch(0.67 0.19 240)', // royal blue
		'oklch(0.78 0.10 95)' // olive
	];

	function getChartData() {
		const allKpis = [kpiName, ...additionalKpis];
		const datasets = allKpis.map((name, i) => {
			const values = appState.getFilteredValues(name, daysOverride);
			return {
				label: name,
				data: values.map((v) => ({ x: v.date.getTime(), y: v.value })),
				borderColor: COLORS[i % COLORS.length],
				backgroundColor: COLORS[i % COLORS.length],
				borderWidth: 1.5,
				pointRadius: 0,
				pointHoverRadius: 3,
				pointHoverBackgroundColor: COLORS[i % COLORS.length],
				tension: 0.3,
				fill: false
			};
		});

		return { datasets };
	}

	function getThresholdAnnotation(): Record<string, unknown> {
		const threshold = appState.thresholds.get(kpiName);
		if (!threshold) return {};

		return {
			thresholdLine: {
				type: 'line',
				yMin: threshold.value,
				yMax: threshold.value,
				borderColor: 'oklch(0.6 0.15 250)',
				borderWidth: 1.5,
				borderDash: [4, 4],
				label: {
					display: true,
					content: formatFloat(threshold.value),
					position: 'end',
					backgroundColor: 'oklch(0.6 0.15 250 / 0.8)',
					color: '#fff',
					font: { size: 9, family: 'Courier New, monospace' },
					padding: { top: 1, bottom: 1, left: 3, right: 3 }
				}
			}
		};
	}

	function getThresholdStatus(): 'passing' | 'failing' | 'none' {
		const latest = appState.getLatestValue(kpiName);
		if (latest === null) return 'none';
		const result = appState.meetsThreshold(kpiName, latest);
		if (result === null) return 'none';
		return result ? 'passing' : 'failing';
	}

	function getChartTitle(): string {
		return appState.getThresholdLabel(kpiName);
	}

	function buildChart() {
		if (!canvasEl) return;

		if (chartInstance) {
			chartInstance.destroy();
			chartInstance = null;
		}

		const ctx = canvasEl.getContext('2d');
		if (!ctx) return;

		const data = getChartData();
		const annotations = getThresholdAnnotation();

		const style = getComputedStyle(document.documentElement);
		const fgColor = style.getPropertyValue('--muted-foreground').trim() || '#888';
		const borderColorVal = style.getPropertyValue('--border').trim() || '#333';

		chartInstance = new Chart(ctx, {
			type: 'line',
			data,
			options: {
				responsive: true,
				maintainAspectRatio: false,
				animation: { duration: 300 },
				interaction: {
					mode: 'index',
					intersect: false
				},
				layout: {
					padding: { top: 4, right: 8, bottom: 0, left: 0 }
				},
				scales: {
					x: {
						type: 'time',
						time: {
							unit: 'day',
							displayFormats: { day: 'MMM d' },
							tooltipFormat: 'MMM d, yyyy'
						},
						ticks: {
							color: fgColor,
							font: { size: 9, family: 'Courier New, monospace' },
							maxRotation: 0,
							maxTicksLimit: 8
						},
						grid: {
							color: borderColorVal,
							lineWidth: 0.3
						},
						border: { display: false }
					},
					y: {
						ticks: {
							color: fgColor,
							font: { size: 9, family: 'Courier New, monospace' },
							callback: (val: string | number) => {
								const n = typeof val === 'string' ? parseFloat(val) : val;
								return formatFloat(n);
							}
						},
						grid: {
							color: borderColorVal,
							lineWidth: 0.3
						},
						border: { display: false }
					}
				},
				plugins: {
					legend: {
						display: additionalKpis.length > 0,
						position: 'bottom',
						labels: {
							color: fgColor,
							font: { size: 9, family: 'Courier New, monospace' },
							boxWidth: 12,
							boxHeight: 2,
							padding: 8
						}
					},
					tooltip: {
						backgroundColor: 'oklch(0.2 0.02 220 / 0.95)',
						titleColor: '#fff',
						bodyColor: '#ccc',
						titleFont: { size: 10, family: 'Courier New, monospace' },
						bodyFont: { size: 10, family: 'Courier New, monospace' },
						padding: 8,
						cornerRadius: 2,
						callbacks: {
							label: (tooltipItem: any) => {
								const label = tooltipItem.dataset?.label ?? '';
								const val = formatFloat(tooltipItem.parsed?.y ?? 0);
								return `${label}: ${val}`;
							}
						}
					},
					annotation: {
						annotations
					} as any
				}
			}
		});
	}

	$effect(() => {
		// Touch reactive deps to trigger rebuilds
		void appState.selectedArea;
		void appState.globalDays;
		void appState.kpiDaysOverride;
		void appState.areaDaysOverride;
		void appState.thresholds;
		void appState.data;
		void kpiName;
		void additionalKpis;
		void daysOverride;

		if (canvasEl) {
			tick().then(() => buildChart());
		}
	});

	onMount(() => {
		if (canvasEl) buildChart();
	});

	onDestroy(() => {
		if (chartInstance) {
			chartInstance.destroy();
			chartInstance = null;
		}
	});

	async function copyToClipboard(e: MouseEvent) {
		e.stopPropagation();
		if (!chartInstance || !canvasEl) return;

		try {
			const tempCanvas = document.createElement('canvas');
			tempCanvas.width = canvasEl.width;
			tempCanvas.height = canvasEl.height;
			const tempCtx = tempCanvas.getContext('2d');
			if (!tempCtx) return;

			tempCtx.drawImage(canvasEl, 0, 0);

			const blob = await new Promise<Blob | null>((resolve) =>
				tempCanvas.toBlob(resolve, 'image/png')
			);

			if (blob) {
				await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
				toast.success('Chart copied to clipboard');
			}
		} catch {
			toast.error('Failed to copy chart');
		}
	}

	function handleCardClick() {
		if (onChartClick) {
			onChartClick();
		}
	}

	// Compute view-transition-name — use vtName when NOT focused, 'none' when focused
	const transitionName = $derived(appState.focusedChart === kpiName ? 'none' : vtName(kpiName));

	const status = $derived(getThresholdStatus());
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="group/chart chart-card relative flex flex-col rounded-sm border border-border bg-card transition-all duration-200
		{fillHeight ? 'h-full' : ''}
		{status === 'failing' ? 'bg-destructive/4' : ''}
		{onChartClick
		? 'cursor-pointer hover:border-primary/40 hover:shadow-[0_0_12px_oklch(0.7971_0.1339_211.5302/0.15)]'
		: ''}"
	style="view-transition-name: {transitionName};"
	role="img"
	aria-label={getChartTitle()}
	onclick={handleCardClick}
	onmouseenter={() => (hovered = true)}
	onmouseleave={() => (hovered = false)}
>
	<!-- Title row -->
	<div class="flex items-center justify-between px-3 pt-2.5 pb-1">
		<div class="flex items-center gap-2">
			<!-- Status dot -->
			{#if status === 'passing'}
				<span class="h-2 w-2 rounded-full bg-green-500"></span>
			{:else if status === 'failing'}
				<span class="status-dot-pulse h-2 w-2 rounded-full bg-destructive"></span>
			{:else}
				<span class="h-2 w-2 rounded-full bg-muted-foreground/30"></span>
			{/if}

			<h3
				class="truncate text-xs font-semibold tracking-wide uppercase {status === 'failing'
					? 'text-destructive'
					: 'text-foreground'}"
				title={getChartTitle()}
			>
				{getChartTitle()}
			</h3>
		</div>

		{#if appState.getLatestValue(kpiName) !== null}
			{@const latest = appState.getLatestValue(kpiName)!}
			<span
				class="ml-2 shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-medium {status === 'failing'
					? 'bg-destructive/15 text-destructive'
					: 'bg-primary/10 text-primary'}"
			>
				{formatFloat(latest)}
			</span>
		{/if}
	</div>

	<!-- Toolbar (appears on hover) -->
	{#if showToolbar}
		<div
			class="absolute top-1 right-1 z-10 flex items-center gap-0.5 rounded-sm border border-border bg-card/95 p-0.5 shadow-sm backdrop-blur-sm transition-opacity {hovered
				? 'opacity-100'
				: 'pointer-events-none opacity-0'}"
		>
			{#if onAddKpi}
				<button
					onclick={(e) => {
						e.stopPropagation();
						onAddKpi?.();
					}}
					class="flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
					title="Compare with another KPI"
				>
					<Plus class="h-3.5 w-3.5" />
				</button>
			{/if}
			{#each additionalKpis as extra}
				<button
					onclick={(e) => {
						e.stopPropagation();
						onRemoveKpi?.(extra);
					}}
					class="flex h-auto items-center gap-0.5 rounded-sm px-1 py-0.5 text-[9px] text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
					title="Remove {extra}"
				>
					{extra}
					<X class="h-2.5 w-2.5" />
				</button>
			{/each}
			<button
				onclick={copyToClipboard}
				class="flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
				title="Copy chart to clipboard"
			>
				<Copy class="h-3.5 w-3.5" />
			</button>
		</div>
	{/if}

	<!-- Chart canvas -->
	<div
		class="flex-1 px-2 pb-2 {fillHeight ? 'relative min-h-0' : ''}"
		style={fillHeight ? '' : 'min-height: 180px;'}
	>
		<canvas bind:this={canvasEl} class={fillHeight ? 'absolute inset-0 h-full w-full' : ''}
		></canvas>
	</div>
</div>
