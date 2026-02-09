<script lang="ts">
	import { useAppState, OPERATORS, formatFloat } from '$lib/stores/app-state.svelte';
	import type { Operator } from '$lib/stores/app-state.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as NativeSelect from '$lib/components/ui/native-select/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { toast } from 'svelte-sonner';
	import { Settings2, Check } from '@lucide/svelte';
	import { SvelteMap } from 'svelte/reactivity';

	const appState = useAppState();

	// Local editable copy of thresholds
	let editableThresholds = $state<{ name: string; operator: Operator; value: string }[]>([]);

	// Initialize editable thresholds from state
	$effect(() => {
		if (appState.kpiNames.length > 0 && editableThresholds.length === 0) {
			editableThresholds = appState.kpiNames.map((name) => {
				const existing = appState.thresholds.get(name);
				return {
					name,
					operator: existing?.operator ?? '>=',
					value: existing?.value !== undefined ? formatFloat(existing.value) : ''
				};
			});
		}
	});

	function applyThresholds() {
		const newThresholds = new SvelteMap(appState.thresholds);
		let validCount = 0;

		for (const item of editableThresholds) {
			const val = parseFloat(item.value);
			if (!isNaN(val)) {
				newThresholds.set(item.name, { operator: item.operator, value: val });
				validCount++;
			}
		}

		appState.thresholds = newThresholds;
		appState.thresholdsConfigured = true;
		toast.success(`Applied thresholds for ${validCount} KPIs`);
	}

	function proceedToGrouping() {
		applyThresholds();
		appState.saveToStorage();
		appState.view = 'grouping';
	}

	/** Apply same operator and value to all KPIs */
	let bulkOperator = $state<Operator>('>=');
	let bulkValue = $state<string | number>('');

	function applyBulk() {
		const val = String(bulkValue).trim();
		if (!val || isNaN(parseFloat(val))) return;
		editableThresholds = editableThresholds.map((t) => ({
			...t,
			operator: bulkOperator,
			value: val
		}));
	}
</script>

<div class="flex min-h-svh flex-col items-center bg-background p-4 pt-8">
	<div class="w-full max-w-4xl space-y-6">
		<!-- Header -->
		<div class="space-y-2">
			<div class="flex items-center gap-2">
				<Settings2 class="h-6 w-6 text-primary" />
				<h1 class="text-xl font-bold text-foreground">Configure Thresholds</h1>
			</div>
			<p class="text-sm text-muted-foreground">
				Set a threshold for each KPI. Charts where the latest value doesn't meet the threshold will
				be highlighted.
			</p>
		</div>

		<!-- Bulk apply -->
		<div class="flex items-end gap-2 rounded-sm border border-border bg-card p-3">
			<div class="space-y-1">
				<label for="bulk-op" class="text-xs text-muted-foreground">Bulk operator</label>
				<NativeSelect.Root id="bulk-op" bind:value={bulkOperator} class="w-24">
					{#each OPERATORS as op}
						<NativeSelect.Option value={op.value}>{op.label}</NativeSelect.Option>
					{/each}
				</NativeSelect.Root>
			</div>
			<div class="flex-1 space-y-1">
				<label for="bulk-val" class="text-xs text-muted-foreground">Bulk value</label>
				<Input
					id="bulk-val"
					type="number"
					step="any"
					bind:value={bulkValue}
					placeholder="e.g. 99.5"
				/>
			</div>
			<Button variant="secondary" size="sm" onclick={applyBulk}>Apply to all</Button>
		</div>

		<!-- Threshold table -->
		<div class="rounded-sm border border-border bg-card">
			<!-- Table header -->
			<div
				class="grid grid-cols-[1fr_100px_150px] gap-2 border-b border-border px-4 py-2 text-xs font-medium text-muted-foreground"
			>
				<span>KPI Name</span>
				<span>Operator</span>
				<span>Threshold Value</span>
			</div>

			<!-- Table body -->
			<div class="max-h-[60vh] overflow-y-auto">
				{#each editableThresholds as item, i}
					<div
						class="grid grid-cols-[1fr_100px_150px] items-center gap-2 border-b border-border/50 px-4 py-1.5 last:border-b-0 {i %
							2 ===
						0
							? ''
							: 'bg-muted/30'}"
					>
						<span class="truncate text-sm text-foreground" title={item.name}>
							{item.name}
						</span>

						<NativeSelect.Root bind:value={item.operator} class="h-8 text-xs">
							{#each OPERATORS as op}
								<NativeSelect.Option value={op.value}>{op.label}</NativeSelect.Option>
							{/each}
						</NativeSelect.Root>

						<Input
							type="number"
							step="any"
							bind:value={item.value}
							placeholder="0"
							class="h-8 text-xs"
						/>
					</div>
				{/each}
			</div>
		</div>

		<!-- Actions -->
		<div class="flex items-center justify-between">
			<Button
				variant="outline"
				onclick={() => {
					appState.view = 'splash';
				}}
			>
				Back
			</Button>
			<div class="flex gap-2">
				<Button variant="secondary" onclick={applyThresholds}>Save Thresholds</Button>
				<Button onclick={proceedToGrouping}>
					<Check class="mr-2 h-4 w-4" />
					Continue
				</Button>
			</div>
		</div>
	</div>
</div>
