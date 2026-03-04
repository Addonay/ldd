<script lang="ts">
	import { useAppState, OPERATORS, formatFloat } from '$lib/stores/app-state.svelte';
	import type { Operator } from '$lib/stores/app-state.svelte';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as NativeSelect from '$lib/components/ui/native-select/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { toast } from 'svelte-sonner';

	const appState = useAppState();

	// Local editable copy
	let editableThresholds = $state<{ name: string; operator: Operator; value: string }[]>([]);

	// Re-init when dialog opens
	$effect(() => {
		if (appState.thresholdDialogOpen && appState.kpiNames.length > 0) {
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

	function save() {
		const newThresholds = new Map(appState.thresholds);
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
		appState.saveToStorage();
		appState.thresholdDialogOpen = false;
		toast.success(`Updated ${validCount} thresholds`);
	}

	let bulkOperator = $state<Operator>('>=');
	let bulkValue = $state('');

	function applyBulk() {
		if (!bulkValue.trim()) return;
		editableThresholds = editableThresholds.map((t) => ({
			...t,
			operator: bulkOperator,
			value: bulkValue
		}));
	}
</script>

<Dialog.Root bind:open={appState.thresholdDialogOpen}>
	<Dialog.Content class="max-h-[85vh] max-w-3xl">
		<Dialog.Header>
			<Dialog.Title>Edit Thresholds</Dialog.Title>
			<Dialog.Description>Update threshold values and operators for each KPI.</Dialog.Description>
		</Dialog.Header>

		<!-- Bulk apply -->
		<div class="flex items-end gap-2 rounded-sm border border-border p-2">
			<NativeSelect.Root bind:value={bulkOperator} class="h-8 w-20 text-xs">
				{#each OPERATORS as op}
					<NativeSelect.Option value={op.value}>{op.label}</NativeSelect.Option>
				{/each}
			</NativeSelect.Root>
			<Input
				type="number"
				step="any"
				bind:value={bulkValue}
				placeholder="value"
				class="h-8 flex-1 text-xs"
			/>
			<Button variant="secondary" size="sm" onclick={applyBulk}>Bulk</Button>
		</div>

		<!-- Table -->
		<div class="max-h-[50vh] overflow-y-auto rounded-sm border border-border">
			<div
				class="sticky top-0 z-10 grid grid-cols-[1fr_90px_130px] gap-2 border-b border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground"
			>
				<span>KPI</span>
				<span>Op</span>
				<span>Value</span>
			</div>
			{#each editableThresholds as item, i}
				<div
					class="grid grid-cols-[1fr_90px_130px] items-center gap-2 border-b border-border/50 px-3 py-1 last:border-b-0 {i %
						2 ===
					0
						? ''
						: 'bg-muted/20'}"
				>
					<span class="truncate text-xs text-foreground">{item.name}</span>
					<NativeSelect.Root bind:value={item.operator} class="h-7 text-[11px]">
						{#each OPERATORS as op}
							<NativeSelect.Option value={op.value}>{op.label}</NativeSelect.Option>
						{/each}
					</NativeSelect.Root>
					<Input type="number" step="any" bind:value={item.value} class="h-7 text-xs" />
				</div>
			{/each}
		</div>

		<Dialog.Footer>
			<Button variant="outline" onclick={() => (appState.thresholdDialogOpen = false)}>
				Cancel
			</Button>
			<Button onclick={save}>Save</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
