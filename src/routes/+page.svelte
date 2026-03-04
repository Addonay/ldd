<div class="relative min-h-screen overflow-hidden bg-background text-foreground">
	<div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.2),_transparent_45%)]"></div>

	<main class="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-6 py-16">
		<div class="mx-auto w-full max-w-3xl text-center">
			<p class="mb-3 inline-flex rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
				LDD Analytics Gateway
			</p>
			<h1 class="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">Choose your workspace</h1>
			<p class="mx-auto mt-4 max-w-2xl text-pretty text-sm text-muted-foreground sm:text-base">
				Open the QoS dashboard for KPI operations, or continue to RNA for the next analytics workflow.
			</p>
		</div>

		<div class="mx-auto mt-10 grid w-full max-w-4xl gap-4 md:grid-cols-2">
			<a
				href="/qos"
				class="group rounded-xl border border-border bg-card/70 p-6 backdrop-blur transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:bg-card"
			>
				<div class="mb-3 text-xs font-medium uppercase tracking-wider text-primary">Production</div>
				<div class="text-xl font-semibold">QoS Dashboard</div>
				<p class="mt-2 text-sm text-muted-foreground">
					Thresholds, KPI grouping, chart generation, and report-driven performance monitoring.
				</p>
				<div class="mt-5 text-sm font-medium text-primary">Enter QoS →</div>
			</a>

			<a
				href="/rna"
				class="group rounded-xl border border-border bg-card/70 p-6 backdrop-blur transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:bg-card"
			>
				<div class="mb-3 text-xs font-medium uppercase tracking-wider text-primary">Next Module</div>
				<div class="text-xl font-semibold">RNA Workspace</div>
				<p class="mt-2 text-sm text-muted-foreground">
					Dedicated RNA experience scaffold, ready for new data flows and module-specific components.
				</p>
				<div class="mt-5 text-sm font-medium text-primary">Open RNA →</div>
			</a>
		</div>
	</main>
</div>
