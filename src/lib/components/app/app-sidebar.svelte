<script lang="ts">
	import { useAppState } from '$lib/stores/app-state.svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import {
		MapPin,
		Settings,
		RotateCcw,
		Sliders,
		FolderOpen,
		FileSpreadsheet
	} from '@lucide/svelte';

	const appState = useAppState();

	function selectArea(area: string) {
		appState.selectedArea = area;
		appState.selectedGroupId = null;
	}

	function toggleGroup(groupId: string) {
		appState.selectedGroupId = appState.selectedGroupId === groupId ? null : groupId;
	}
</script>

<Sidebar.Sidebar>
	<Sidebar.SidebarHeader class="border-b border-sidebar-border p-4">
		<div class="flex items-center gap-2">
			<FileSpreadsheet class="h-5 w-5 text-sidebar-primary" />
			<span class="text-sm font-bold text-sidebar-foreground">KPI Dashboard</span>
		</div>
	</Sidebar.SidebarHeader>

	<Sidebar.SidebarContent>
		<!-- Areas -->
		<Sidebar.SidebarGroup>
			<Sidebar.SidebarGroupLabel>
				<MapPin class="mr-1.5 h-3.5 w-3.5" />
				Areas
			</Sidebar.SidebarGroupLabel>
			<Sidebar.SidebarGroupContent>
				<Sidebar.SidebarMenu>
					{#each appState.areaNames as area}
						<Sidebar.SidebarMenuItem>
							<Sidebar.SidebarMenuButton
								onclick={() => selectArea(area)}
								isActive={appState.selectedArea === area}
							>
								<MapPin class="h-4 w-4" />
								<span>{area}</span>
							</Sidebar.SidebarMenuButton>
						</Sidebar.SidebarMenuItem>
					{/each}
				</Sidebar.SidebarMenu>
			</Sidebar.SidebarGroupContent>
		</Sidebar.SidebarGroup>

		<!-- Groups -->
		{#if appState.kpiGroups.length > 0}
			<Sidebar.SidebarGroup>
				<Sidebar.SidebarGroupLabel>
					<FolderOpen class="mr-1.5 h-3.5 w-3.5" />
					KPI Groups
				</Sidebar.SidebarGroupLabel>
				<Sidebar.SidebarGroupContent>
					<Sidebar.SidebarMenu>
						<Sidebar.SidebarMenuItem>
							<Sidebar.SidebarMenuButton
								onclick={() => (appState.selectedGroupId = null)}
								isActive={appState.selectedGroupId === null}
							>
								<FolderOpen class="h-4 w-4" />
								<span>All Groups</span>
							</Sidebar.SidebarMenuButton>
						</Sidebar.SidebarMenuItem>
						{#each appState.kpiGroups as group}
							<Sidebar.SidebarMenuItem>
								<Sidebar.SidebarMenuButton
									onclick={() => toggleGroup(group.id)}
									isActive={appState.selectedGroupId === group.id}
								>
									<FolderOpen class="h-4 w-4" />
									<span>{group.name}</span>
									<Sidebar.SidebarMenuBadge>
										{group.kpiNames.length}
									</Sidebar.SidebarMenuBadge>
								</Sidebar.SidebarMenuButton>
							</Sidebar.SidebarMenuItem>
						{/each}
					</Sidebar.SidebarMenu>
				</Sidebar.SidebarGroupContent>
			</Sidebar.SidebarGroup>
		{/if}
	</Sidebar.SidebarContent>

	<Sidebar.SidebarFooter class="border-t border-sidebar-border p-2">
		<Sidebar.SidebarMenu>
			<Sidebar.SidebarMenuItem>
				<Sidebar.SidebarMenuButton onclick={() => (appState.thresholdDialogOpen = true)}>
					<Sliders class="h-4 w-4" />
					<span>Thresholds</span>
				</Sidebar.SidebarMenuButton>
			</Sidebar.SidebarMenuItem>
			<Sidebar.SidebarMenuItem>
				<Sidebar.SidebarMenuButton onclick={() => (appState.groupDialogOpen = true)}>
					<FolderOpen class="h-4 w-4" />
					<span>Manage Groups</span>
				</Sidebar.SidebarMenuButton>
			</Sidebar.SidebarMenuItem>
			<Sidebar.SidebarMenuItem>
				<Sidebar.SidebarMenuButton onclick={() => (appState.settingsOpen = true)}>
					<Settings class="h-4 w-4" />
					<span>Settings</span>
				</Sidebar.SidebarMenuButton>
			</Sidebar.SidebarMenuItem>
			<Sidebar.SidebarMenuItem>
				<Sidebar.SidebarMenuButton
					onclick={() => {
						appState.reset();
					}}
				>
					<RotateCcw class="h-4 w-4" />
					<span>New File</span>
				</Sidebar.SidebarMenuButton>
			</Sidebar.SidebarMenuItem>
		</Sidebar.SidebarMenu>
	</Sidebar.SidebarFooter>

	<Sidebar.SidebarRail />
</Sidebar.Sidebar>
