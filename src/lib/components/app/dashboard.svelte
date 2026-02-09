<script lang="ts">
	import { useAppState } from '$lib/stores/app-state.svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import AppSidebar from './app-sidebar.svelte';
	import KpiGroup from './kpi-group.svelte';
	import ChartFocusModal from './chart-focus-modal.svelte';
	import SettingsDialog from './settings-dialog.svelte';
	import ThresholdDialog from './threshold-dialog.svelte';
	import GroupDialog from './group-dialog.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import {
		MapPin,
		Calendar,
		ChevronLeft,
		Activity,
		CheckCircle,
		XCircle,
		HelpCircle
	} from '@lucide/svelte';

	const appState = useAppState();
	const stats = $derived(appState.getStats());
</script>

<Sidebar.SidebarProvider bind:open={appState.sidebarOpen}>
	<AppSidebar />

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
					<span class="flex items-center gap-1 text-green-500">
						<CheckCircle class="h-3 w-3" />
						{stats.passing}
					</span>
					<span class="flex items-center gap-1 text-destructive">
						<XCircle class="h-3 w-3" />
						{stats.failing}
					</span>
					<span class="flex items-center gap-1 text-muted-foreground">
						<HelpCircle class="h-3 w-3" />
						{stats.noThreshold}
					</span>
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
					onclick={() => {
						appState.view = 'thresholds';
					}}
				>
					<ChevronLeft class="mr-1 h-3 w-3" />
					Thresholds
				</Button>
			</div>
		</header>

		<!-- Summary stats bar -->
		<div class="flex items-center gap-4 border-b border-border/50 bg-card/50 px-4 py-1.5 md:hidden">
			<span class="flex items-center gap-1 text-[10px] text-green-500">
				<CheckCircle class="h-3 w-3" />
				{stats.passing} passing
			</span>
			<span class="flex items-center gap-1 text-[10px] text-destructive">
				<XCircle class="h-3 w-3" />
				{stats.failing} failing
			</span>
			<span class="flex items-center gap-1 text-[10px] text-muted-foreground">
				<HelpCircle class="h-3 w-3" />
				{stats.noThreshold} no threshold
			</span>
		</div>

		<!-- Main content -->
		<main class="flex-1 overflow-y-auto p-4">
			{#if appState.data.size === 0}
				<div class="flex h-full items-center justify-center">
					<p class="text-sm text-muted-foreground">No data loaded</p>
				</div>
			{:else}
				<!-- Render grouped KPIs first -->
				{#each appState.kpiGroups as group (group.id)}
					<KpiGroup groupName={group.name} kpiNames={group.kpiNames} />
				{/each}

				<!-- Render ungrouped KPIs -->
				{#if appState.ungroupedKpis.length > 0}
					<KpiGroup
						groupName={appState.kpiGroups.length > 0 ? 'Other KPIs' : 'All KPIs'}
						kpiNames={appState.ungroupedKpis}
					/>
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
