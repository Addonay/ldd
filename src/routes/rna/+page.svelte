<script lang="ts">
	import RnaSidebar from '$lib/components/rna/rna-sidebar.svelte';
	import { Button } from '$lib/components/ui/button';
</script>

<div class="relative min-h-screen overflow-hidden bg-background text-foreground">
	<div class="pointer-events-none absolute inset-0 "></div>

	<main class="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-10 md:flex-row md:gap-6 md:px-6 md:py-14">
		<RnaSidebar />

		<div class="mt-4 flex-1 rounded-2xl border border-border bg-card/70 p-8 backdrop-blur md:mt-0 sm:p-12">
			<p class="mb-3 inline-flex rounded-full border border-border/60 bg-background/70 px-3 py-1 text-xs text-muted-foreground">
				RNA Workspace
			</p>
			<h1 class="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">RNA module is ready to build</h1>
			<p class="mt-4 max-w-2xl text-sm text-muted-foreground sm:text-base">
				This page is now separated from QoS so you can add RNA-specific flows, storage, components, and sidebars independently.
			</p>
			<div class="mt-8 flex flex-wrap gap-3">
				<Button
					href="/qos"
					class="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
				>
					Open QoS
				</Button>
				<Button
					href="/"
					class="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
				>
					Return Home
            </Button>
			</div>
		</div>
	</main>
</div>
