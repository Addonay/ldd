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
	let chartCardEl: HTMLDivElement | undefined = $state();
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
		const primaryData = (data.datasets[0]?.data ?? []) as Array<{ x: number; y: number }>;
		const minX = primaryData[0]?.x;
		const maxX = primaryData[primaryData.length - 1]?.x;
		const startDayTs =
			typeof minX === 'number' ? new Date(new Date(minX).setHours(0, 0, 0, 0)).getTime() : undefined;
		const endDayTs =
			typeof maxX === 'number' ? new Date(new Date(maxX).setHours(0, 0, 0, 0)).getTime() : undefined;
		const totalDays =
			typeof startDayTs === 'number' && typeof endDayTs === 'number'
				? Math.max(1, Math.round((endDayTs - startDayTs) / 86_400_000) + 1)
				: 0;
		const showAllDates = totalDays > 0 && totalDays <= 30;

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
						afterBuildTicks: (scale) => {
							if (!showAllDates || typeof startDayTs !== 'number' || typeof endDayTs !== 'number') {
								return;
							}

							const ticks: Array<{ value: number }> = [];
							for (let ts = startDayTs; ts <= endDayTs; ts += 86_400_000) {
								ticks.push({ value: ts });
							}
							scale.ticks = ticks as any;
						},
						min: minX,
						max: maxX,
						ticks: {
							color: fgColor,
							font: { size: 9, family: 'Courier New, monospace' },
							minRotation: showAllDates ? 60 : 0,
							maxRotation: showAllDates ? 90 : 0,
							autoSkip: !showAllDates,
							maxTicksLimit: showAllDates ? Math.max(7, totalDays) : 8
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
					title: {
						display: false
					},
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

	function drawRoundedRect(
		ctx: CanvasRenderingContext2D,
		x: number,
		y: number,
		width: number,
		height: number,
		radius: number,
		fillStyle: string
	) {
		const r = Math.max(0, Math.min(radius, Math.min(width, height) / 2));
		ctx.fillStyle = fillStyle;
		ctx.beginPath();
		ctx.moveTo(x + r, y);
		ctx.lineTo(x + width - r, y);
		ctx.quadraticCurveTo(x + width, y, x + width, y + r);
		ctx.lineTo(x + width, y + height - r);
		ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
		ctx.lineTo(x + r, y + height);
		ctx.quadraticCurveTo(x, y + height, x, y + height - r);
		ctx.lineTo(x, y + r);
		ctx.quadraticCurveTo(x, y, x + r, y);
		ctx.closePath();
		ctx.fill();
	}

	function drawWrappedText(
		ctx: CanvasRenderingContext2D,
		text: string,
		x: number,
		y: number,
		maxWidth: number,
		lineHeight: number
	) {
		if (!text || maxWidth <= 0) return;

		const lines: string[] = [];
		let currentLine = '';

		for (const char of Array.from(text)) {
			if (char === '\n') {
				lines.push(currentLine);
				currentLine = '';
				continue;
			}

			const candidate = `${currentLine}${char}`;
			if (!currentLine || ctx.measureText(candidate).width <= maxWidth) {
				currentLine = candidate;
			} else {
				lines.push(currentLine);
				currentLine = char;
			}
		}

		if (currentLine) lines.push(currentLine);

		lines.forEach((line, i) => {
			ctx.fillText(line, x, y + i * lineHeight);
		});
	}

	async function createChartCardBlob(): Promise<Blob | null> {
		if (!chartCardEl || !canvasEl) return null;

		const cardRect = chartCardEl.getBoundingClientRect();
		const canvasRect = canvasEl.getBoundingClientRect();
		if (!cardRect.width || !cardRect.height) return null;

		const canvasScaleX = canvasRect.width ? canvasEl.width / canvasRect.width : 1;
		const canvasScaleY = canvasRect.height ? canvasEl.height / canvasRect.height : 1;
		const baseScale = Math.max(canvasScaleX, canvasScaleY, window.devicePixelRatio || 1);
		const scale = Math.min(4, Math.max(2.5, baseScale * 1.5));
		const tempCanvas = document.createElement('canvas');
		tempCanvas.width = Math.round(cardRect.width * scale);
		tempCanvas.height = Math.round(cardRect.height * scale);
		const tempCtx = tempCanvas.getContext('2d');
		if (!tempCtx) return null;
		tempCtx.imageSmoothingEnabled = true;
		tempCtx.imageSmoothingQuality = 'high';

		tempCtx.fillStyle = '#ffffff';
		tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

		const drawX = (canvasRect.left - cardRect.left) * scale;
		const drawY = (canvasRect.top - cardRect.top) * scale;
		const drawW = canvasRect.width * scale;
		const drawH = canvasRect.height * scale;
		tempCtx.drawImage(canvasEl, drawX, drawY, drawW, drawH);

		const latestEl = chartCardEl.querySelector('[data-copy-latest]') as HTMLElement | null;
		const latestRect = latestEl?.getBoundingClientRect();

		const statusDot = chartCardEl.querySelector('[data-copy-status-dot]') as HTMLElement | null;
		if (statusDot) {
			const dotRect = statusDot.getBoundingClientRect();
			const dotStyle = getComputedStyle(statusDot);
			const centerX = (dotRect.left - cardRect.left + dotRect.width / 2) * scale;
			const centerY = (dotRect.top - cardRect.top + dotRect.height / 2) * scale;
			const radius = (Math.min(dotRect.width, dotRect.height) / 2) * scale;
			tempCtx.fillStyle = dotStyle.backgroundColor || '#888';
			tempCtx.beginPath();
			tempCtx.arc(centerX, centerY, radius, 0, Math.PI * 2);
			tempCtx.fill();
		}

		const titleEl = chartCardEl.querySelector('[data-copy-title]') as HTMLElement | null;
		if (titleEl) {
			const titleRect = titleEl.getBoundingClientRect();
			const titleStyle = getComputedStyle(titleEl);
			const fontSize = parseFloat(titleStyle.fontSize) * scale;
			tempCtx.fillStyle = titleStyle.color || '#111';
			tempCtx.font = `${titleStyle.fontWeight} ${fontSize}px ${titleStyle.fontFamily}`;
			tempCtx.textBaseline = 'top';

			const titleText = titleEl.textContent?.trim() ?? getChartTitle();
			const titleX = (titleRect.left - cardRect.left) * scale;
			const titleY = (titleRect.top - cardRect.top) * scale;
			const titleGap = 8 * scale;
			const titleRightLimit = latestRect
				? (latestRect.left - cardRect.left) * scale - titleGap
				: tempCanvas.width - 12 * scale;
			const maxTitleWidth = Math.max(0, titleRightLimit - titleX);
			const styleLineHeight = parseFloat(titleStyle.lineHeight);
			const lineHeight = Number.isFinite(styleLineHeight) ? styleLineHeight * scale : fontSize * 1.2;

			tempCtx.save();
			tempCtx.beginPath();
			tempCtx.rect(titleX, titleY, maxTitleWidth, titleRect.height * scale);
			tempCtx.clip();
			drawWrappedText(tempCtx, titleText, titleX, titleY, maxTitleWidth, lineHeight);
			tempCtx.restore();
		}

		if (latestEl) {
			const latestRectSafe = latestRect ?? latestEl.getBoundingClientRect();
			const latestStyle = getComputedStyle(latestEl);
			const x = (latestRectSafe.left - cardRect.left) * scale;
			const y = (latestRectSafe.top - cardRect.top) * scale;
			const w = latestRectSafe.width * scale;
			const h = latestRectSafe.height * scale;
			const radius = parseFloat(latestStyle.borderTopLeftRadius || '2') * scale;

			drawRoundedRect(tempCtx, x, y, w, h, radius, latestStyle.backgroundColor || '#eee');

			const fontSize = parseFloat(latestStyle.fontSize) * scale;
			tempCtx.fillStyle = latestStyle.color || '#222';
			tempCtx.font = `${latestStyle.fontWeight} ${fontSize}px ${latestStyle.fontFamily}`;
			tempCtx.textAlign = 'center';
			tempCtx.textBaseline = 'middle';
			tempCtx.fillText(latestEl.textContent?.trim() ?? '', x + w / 2, y + h / 2);
			tempCtx.textAlign = 'start';
			tempCtx.textBaseline = 'alphabetic';
		}

		return await new Promise<Blob | null>((resolve) => tempCanvas.toBlob(resolve, 'image/png'));
	}

	export async function copyChartToClipboard() {
		if (!chartCardEl || !canvasEl) return;

		try {
			const blob = await createChartCardBlob();
			if (!blob) return;
			await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
			toast.success('Chart copied to clipboard');
		} catch {
			toast.error('Failed to copy chart');
		}
	}

	async function copyToClipboard(e: MouseEvent) {
		e.stopPropagation();
		await copyChartToClipboard();
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
	bind:this={chartCardEl}
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
		<div class="flex min-w-0 flex-1 items-center gap-2">
			<!-- Status dot -->
			{#if status === 'passing'}
				<span data-copy-status-dot class="h-2 w-2 rounded-full bg-green-500"></span>
			{:else if status === 'failing'}
				<span data-copy-status-dot class="status-dot-pulse h-2 w-2 rounded-full bg-destructive"
				></span>
			{:else}
				<span data-copy-status-dot class="h-2 w-2 rounded-full bg-muted-foreground/30"></span>
			{/if}

			<h3
				data-copy-title
				class="min-w-0 break-all text-xs font-semibold tracking-wide uppercase leading-tight whitespace-normal {status === 'failing'
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
				data-copy-latest
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
