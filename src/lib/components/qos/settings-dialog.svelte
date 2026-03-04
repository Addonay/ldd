<script lang="ts">
	import { useAppState, OPERATORS, formatFloat } from '$lib/stores/app-state.svelte';
	import type { Operator } from '$lib/stores/app-state.svelte';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as NativeSelect from '$lib/components/ui/native-select/index.js';
	import { Slider } from '$lib/components/ui/slider/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { toast } from 'svelte-sonner';

	const appState = useAppState();

	let globalDaysInput = $state(appState.globalDays);

	function applySettings() {
		appState.globalDays = globalDaysInput;
		appState.saveToStorage();
		appState.settingsOpen = false;
		toast.success('Settings applied');
	}
</script>

<Dialog.Root bind:open={appState.settingsOpen}>
	<Dialog.Content class="max-w-lg">
		<Dialog.Header>
			<Dialog.Title>Dashboard Settings</Dialog.Title>
			<Dialog.Description>Configure global display options.</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-6 py-4">
			<!-- Global date range -->
			<div class="space-y-3">
				<Label>Default Date Range (days)</Label>
				<div class="flex items-center gap-4">
					<Slider
						type="single"
						bind:value={globalDaysInput}
						min={7}
						max={180}
						step={1}
						class="flex-1"
					/>
					<span class="w-12 text-right text-sm font-medium text-foreground">
						{globalDaysInput}
					</span>
				</div>
				<p class="text-xs text-muted-foreground">
					Shows data for the last {globalDaysInput} days. Range: 7-180 days.
				</p>
			</div>

			<Separator />

			<!-- Per-area overrides -->
			<div class="space-y-3">
				<Label>Per-Area Date Range Overrides</Label>
				<p class="text-xs text-muted-foreground">
					Leave empty to use global default ({globalDaysInput} days).
				</p>
				<div class="space-y-2">
					{#each appState.areaNames as area}
						{@const current = appState.areaDaysOverride.get(area)}
						<div class="flex items-center gap-2">
							<span class="w-24 text-sm text-foreground">{area}</span>
							<Input
								type="number"
								min="7"
								max="180"
								placeholder={String(globalDaysInput)}
								value={current ?? ''}
								class="h-8 w-24 text-xs"
								oninput={(e: Event) => {
									const val = parseInt((e.target as HTMLInputElement).value);
									const m = new Map(appState.areaDaysOverride);
									if (isNaN(val)) {
										m.delete(area);
									} else {
										m.set(area, Math.max(7, Math.min(180, val)));
									}
									appState.areaDaysOverride = m;
								}}
							/>
							<span class="text-xs text-muted-foreground">days</span>
						</div>
					{/each}
				</div>
			</div>

			<Separator />

			<!-- Clear all settings -->
			<div class="space-y-2">
				<Label>Danger Zone</Label>
				<Button
					variant="destructive"
					size="sm"
					onclick={() => {
						appState.clearAllSettings();
						toast.info('All saved settings cleared');
					}}
				>
					Clear All Saved Settings
				</Button>
				<p class="text-xs text-muted-foreground">
					Removes saved thresholds, groups, and preferences from localStorage.
				</p>
			</div>
		</div>

		<Dialog.Footer>
			<Button variant="outline" onclick={() => (appState.settingsOpen = false)}>Cancel</Button>
			<Button onclick={applySettings}>Apply</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
