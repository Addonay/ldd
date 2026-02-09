<script lang="ts">
	import { useAppState } from '$lib/stores/app-state.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { toast } from 'svelte-sonner';
	import { Layers, Check, ChevronRight, X, ArrowRight } from '@lucide/svelte';

	const appState = useAppState();

	// Current group being built
	let groupName = $state('');
	let selectedKpis = $state<Set<string>>(new Set());
	let showNameInput = $state(false);
	let nameInputEl: HTMLInputElement | null = $state(null);

	function toggleKpi(name: string) {
		const next = new Set(selectedKpis);
		if (next.has(name)) {
			next.delete(name);
		} else {
			next.add(name);
		}
		selectedKpis = next;

		// Show name input when first KPI is selected
		if (next.size > 0 && !showNameInput) {
			showNameInput = true;
			// Focus the input after it renders
			requestAnimationFrame(() => nameInputEl?.focus());
		}
		if (next.size === 0) {
			showNameInput = false;
			groupName = '';
		}
	}

	function confirmGroup() {
		if (!groupName.trim()) {
			toast.error('Please enter a group name');
			return;
		}
		if (selectedKpis.size === 0) {
			toast.error('Please select at least one KPI');
			return;
		}

		appState.addGroup(groupName.trim(), [...selectedKpis]);
		toast.success(`Created group "${groupName.trim()}" with ${selectedKpis.size} KPIs`);

		// Reset for next group
		groupName = '';
		selectedKpis = new Set();
		showNameInput = false;
	}

	function cancelGroup() {
		groupName = '';
		selectedKpis = new Set();
		showNameInput = false;
	}

	function removeGroup(id: string) {
		appState.removeGroup(id);
		toast.info('Group removed');
	}

	function finish() {
		appState.saveToStorage();
		appState.view = 'dashboard';
	}

	function skipGrouping() {
		appState.view = 'dashboard';
	}

	// Get the group a KPI belongs to, if any
	function getGroupFor(kpiName: string): string | null {
		for (const g of appState.kpiGroups) {
			if (g.kpiNames.includes(kpiName)) return g.name;
		}
		return null;
	}
</script>

<div class="flex min-h-svh flex-col items-center bg-background p-4 pt-8">
	<div class="w-full max-w-3xl space-y-6">
		<!-- Header -->
		<div class="space-y-2">
			<div class="flex items-center gap-2">
				<Layers class="h-6 w-6 text-primary" />
				<h1 class="text-xl font-bold text-foreground">Organize KPI Groups</h1>
			</div>
			<p class="text-sm text-muted-foreground">
				Select KPIs to organize them into named groups. Groups will be displayed as sections on the
				dashboard. You can skip this step if you prefer a flat list.
			</p>
		</div>

		<!-- Existing groups -->
		{#if appState.kpiGroups.length > 0}
			<div class="space-y-2">
				<h3 class="text-xs font-medium tracking-wider text-muted-foreground uppercase">
					Created Groups
				</h3>
				<div class="space-y-1.5">
					{#each appState.kpiGroups as group (group.id)}
						<div
							class="flex animate-in items-center justify-between rounded-sm border border-border bg-card px-3 py-2 fade-in-0 slide-in-from-left-2"
						>
							<div class="flex items-center gap-2">
								<span class="text-sm font-medium text-foreground">{group.name}</span>
								<span class="rounded-sm bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
									{group.kpiNames.length} KPIs
								</span>
							</div>
							<button
								onclick={() => removeGroup(group.id)}
								class="flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
								title="Remove group"
							>
								<X class="h-3.5 w-3.5" />
							</button>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Group name input (appears above KPI list when selecting) -->
		{#if showNameInput}
			<div
				class="flex animate-in items-center gap-2 rounded-sm border border-primary/30 bg-primary/5 p-3 fade-in-0 slide-in-from-top-2"
			>
				<Input
					bind:ref={nameInputEl}
					bind:value={groupName}
					placeholder="Group name (e.g. RNA KPIs, Throughput, Voice...)"
					class="h-8 flex-1 text-sm"
					onkeydown={(e) => {
						if (e.key === 'Enter' && groupName.trim() && selectedKpis.size > 0) confirmGroup();
					}}
				/>
				<span class="shrink-0 text-xs text-muted-foreground">
					{selectedKpis.size} selected
				</span>
				<Button
					size="sm"
					onclick={confirmGroup}
					disabled={!groupName.trim() || selectedKpis.size === 0}
				>
					<Check class="mr-1 h-3.5 w-3.5" />
					Create
				</Button>
				<Button size="sm" variant="ghost" onclick={cancelGroup}>
					<X class="h-3.5 w-3.5" />
				</Button>
			</div>
		{/if}

		<!-- KPI list -->
		<div class="rounded-sm border border-border bg-card">
			<div class="border-b border-border px-4 py-2">
				<span class="text-xs font-medium tracking-wider text-muted-foreground uppercase">
					All KPIs ({appState.kpiNames.length})
				</span>
			</div>
			<div class="max-h-[55vh] overflow-y-auto">
				{#each appState.kpiNames as name, i (name)}
					{@const groupedIn = getGroupFor(name)}
					{@const isSelected = selectedKpis.has(name)}
					{@const isGrouped = groupedIn !== null}
					<button
						class="flex w-full items-center gap-3 border-b border-border/50 px-4 py-2.5 text-left transition-colors last:border-b-0
							{isSelected
							? 'bg-primary/10'
							: isGrouped
								? 'opacity-50'
								: i % 2 === 0
									? 'hover:bg-accent/50'
									: 'bg-muted/20 hover:bg-accent/50'}"
						onclick={() => !isGrouped && toggleKpi(name)}
						disabled={isGrouped}
					>
						<!-- Checkbox indicator -->
						<div
							class="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border transition-colors
								{isSelected ? 'border-primary bg-primary' : 'border-border'}"
						>
							{#if isSelected}
								<Check class="h-3 w-3 text-primary-foreground" />
							{/if}
						</div>

						<!-- KPI name -->
						<span
							class="flex-1 text-sm {isGrouped
								? 'text-muted-foreground line-through'
								: 'text-foreground'}"
						>
							{name}
						</span>

						<!-- Group badge for already-grouped KPIs -->
						{#if isGrouped}
							<span class="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
								{groupedIn}
							</span>
						{/if}
					</button>
				{/each}
			</div>
		</div>

		<!-- Actions -->
		<div class="flex items-center justify-between">
			<Button
				variant="outline"
				onclick={() => {
					appState.view = 'thresholds';
				}}
			>
				Back
			</Button>
			<div class="flex gap-2">
				<Button variant="ghost" onclick={skipGrouping}>
					Skip
					<ChevronRight class="ml-1 h-3.5 w-3.5" />
				</Button>
				<Button onclick={finish}>
					<ArrowRight class="mr-2 h-4 w-4" />
					Finish
				</Button>
			</div>
		</div>
	</div>
</div>
