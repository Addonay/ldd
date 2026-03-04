<script lang="ts">
	import { useAppState } from '$lib/stores/app-state.svelte';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { toast } from 'svelte-sonner';
	import { Plus, Trash2, GripVertical } from '@lucide/svelte';

	const appState = useAppState();

	let newGroupName = $state('');
	let selectedKpis = $state<Set<string>>(new Set());

	function addGroup() {
		if (!newGroupName.trim()) {
			toast.error('Please enter a group name');
			return;
		}
		if (selectedKpis.size === 0) {
			toast.error('Please select at least one KPI');
			return;
		}
		appState.addGroup(newGroupName.trim(), [...selectedKpis]);
		newGroupName = '';
		selectedKpis = new Set();
		toast.success('Group created');
	}

	function toggleKpi(name: string) {
		const next = new Set(selectedKpis);
		if (next.has(name)) {
			next.delete(name);
		} else {
			next.add(name);
		}
		selectedKpis = next;
	}
</script>

<Dialog.Root bind:open={appState.groupDialogOpen}>
	<Dialog.Content class="max-h-[85vh] max-w-2xl">
		<Dialog.Header>
			<Dialog.Title>Manage KPI Groups</Dialog.Title>
			<Dialog.Description>
				Organize KPIs into named groups. Grouped KPIs will be displayed together with a section
				header.
			</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-4">
			<!-- Existing groups -->
			{#if appState.kpiGroups.length > 0}
				<div class="space-y-2">
					<h4 class="text-sm font-medium text-foreground">Existing Groups</h4>
					{#each appState.kpiGroups as group}
						<div class="flex items-center justify-between rounded-sm border border-border p-2">
							<div>
								<span class="text-sm font-medium text-foreground">{group.name}</span>
								<span class="ml-2 text-xs text-muted-foreground">
									({group.kpiNames.length} KPIs)
								</span>
								<div class="mt-1 flex flex-wrap gap-1">
									{#each group.kpiNames as kpi}
										<span
											class="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
										>
											{kpi}
										</span>
									{/each}
								</div>
							</div>
							<Button variant="ghost" size="sm" onclick={() => appState.removeGroup(group.id)}>
								<Trash2 class="h-4 w-4 text-destructive" />
							</Button>
						</div>
					{/each}
				</div>

				<Separator />
			{/if}

			<!-- New group -->
			<div class="space-y-3">
				<h4 class="text-sm font-medium text-foreground">Create New Group</h4>
				<Input bind:value={newGroupName} placeholder="Group name (e.g. RNA KPIs)" class="h-8" />

				<div class="max-h-[250px] overflow-y-auto rounded-sm border border-border">
					{#each appState.kpiNames as name, i}
						{@const isSelected = selectedKpis.has(name)}
						{@const isGrouped = appState.groupedKpis.has(name)}
						<button
							class="flex w-full items-center gap-2 border-b border-border/50 px-3 py-1.5 text-left text-sm transition-colors last:border-b-0
								{isSelected ? 'bg-primary/10' : i % 2 === 0 ? '' : 'bg-muted/20'}
								{isGrouped ? 'opacity-50' : 'hover:bg-accent'}"
							onclick={() => !isGrouped && toggleKpi(name)}
							disabled={isGrouped}
						>
							<div
								class="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-border {isSelected
									? 'border-primary bg-primary'
									: ''}"
							>
								{#if isSelected}
									<span class="text-[10px] text-primary-foreground">&#10003;</span>
								{/if}
							</div>
							<span class="text-foreground {isGrouped ? 'line-through' : ''}">
								{name}
							</span>
							{#if isGrouped}
								<span class="text-xs text-muted-foreground">(already grouped)</span>
							{/if}
						</button>
					{/each}
				</div>

				<Button
					onclick={addGroup}
					disabled={!newGroupName.trim() || selectedKpis.size === 0}
					size="sm"
				>
					<Plus class="mr-1.5 h-3.5 w-3.5" />
					Create Group ({selectedKpis.size} selected)
				</Button>
			</div>
		</div>

		<Dialog.Footer>
			<Button variant="outline" onclick={() => (appState.groupDialogOpen = false)}>Done</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
