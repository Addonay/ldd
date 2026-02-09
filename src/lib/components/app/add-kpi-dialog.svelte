<script lang="ts">
	import { useAppState } from '$lib/stores/app-state.svelte';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
	import { Search } from '@lucide/svelte';

	interface Props {
		open: boolean;
		primaryKpi: string;
		currentOverlays: string[];
		onClose: () => void;
		onAdd: (kpiName: string) => void;
	}

	let { open = $bindable(), primaryKpi, currentOverlays, onClose, onAdd }: Props = $props();

	const appState = useAppState();

	let search = $state('');

	let filteredKpis = $derived.by(() => {
		const q = search.toLowerCase().trim();
		return appState.kpiNames.filter((name) => {
			if (name === primaryKpi) return false;
			if (currentOverlays.includes(name)) return false;
			if (q && !name.toLowerCase().includes(q)) return false;
			return true;
		});
	});

	function select(name: string) {
		onAdd(name);
		open = false;
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="max-w-md">
		<Dialog.Header>
			<Dialog.Title>Compare KPIs</Dialog.Title>
			<Dialog.Description>
				Add a KPI to overlay on the <span class="font-medium text-foreground">{primaryKpi}</span> chart.
			</Dialog.Description>
		</Dialog.Header>

		<!-- Search -->
		<div class="relative">
			<Search class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
			<Input bind:value={search} placeholder="Search KPIs..." class="pl-9" />
		</div>

		<!-- KPI list -->
		<div class="max-h-[300px] overflow-y-auto rounded-sm border border-border">
			{#each filteredKpis as name, i}
				<button
					class="flex w-full items-center gap-2 border-b border-border/50 px-3 py-2 text-left text-sm text-foreground transition-colors last:border-b-0 hover:bg-accent {i %
						2 ===
					0
						? ''
						: 'bg-muted/20'}"
					onclick={() => select(name)}
				>
					{name}
				</button>
			{:else}
				<div class="px-3 py-6 text-center text-sm text-muted-foreground">
					No matching KPIs found
				</div>
			{/each}
		</div>

		<Dialog.Footer>
			<Button variant="outline" onclick={onClose}>Cancel</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
