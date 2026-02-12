import { getContext, setContext, tick } from 'svelte';
import { SvelteMap, SvelteSet } from 'svelte/reactivity';

// ── Types ──────────────────────────────────────────────────────

export type Operator = '>=' | '<=' | '>' | '<' | '==' | '!=';

export interface Threshold {
	operator: Operator;
	value: number;
}

export interface KpiDataPoint {
	date: Date;
	value: number;
}

export interface KpiData {
	name: string;
	values: KpiDataPoint[];
}

export interface AreaData {
	name: string;
	kpis: KpiData[];
}

export interface KpiGroup {
	id: string;
	name: string;
	kpiNames: string[];
}

export interface ChartOverlay {
	/** The primary KPI this chart is for */
	primaryKpi: string;
	/** Additional KPIs overlaid on this chart */
	additionalKpis: string[];
}

export const OPERATORS: { label: string; value: Operator }[] = [
	{ label: '>=', value: '>=' },
	{ label: '<=', value: '<=' },
	{ label: '>', value: '>' },
	{ label: '<', value: '<' },
	{ label: '==', value: '==' },
	{ label: '!=', value: '!=' }
];

// ── localStorage keys ──────────────────────────────────────────

const LS_THRESHOLDS = 'ldd-thresholds';
const LS_GROUPS = 'ldd-groups';
const LS_SETTINGS = 'ldd-settings';

// ── State class ────────────────────────────────────────────────

const APP_STATE_KEY = Symbol('app-state');

export class AppState {
	// ── Data ──
	/** Parsed data keyed by area name */
	data = $state<Map<string, AreaData>>(new SvelteMap());

	/** All discovered KPI names (from the first parsed area) */
	kpiNames = $state<string[]>([]);

	/** All area names discovered from the file */
	areaNames = $state<string[]>([]);

	/** Whether data has been loaded */
	hasData = $derived(this.data.size > 0);

	// ── Thresholds ──
	/** Threshold per KPI name */
	thresholds = $state<Map<string, Threshold>>(new SvelteMap());

	/** Whether thresholds have been configured */
	thresholdsConfigured = $state(false);

	// ── View state ──
	/** Currently selected area */
	selectedArea = $state<string>('');

	/** Number of days to show (default 30) */
	globalDays = $state(30);

	/** Per-KPI day overrides */
	kpiDaysOverride = $state<Map<string, number>>(new SvelteMap());

	/** Per-area day overrides */
	areaDaysOverride = $state<Map<string, number>>(new SvelteMap());

	// ── Grouping ──
	/** Named groups of KPIs */
	kpiGroups = $state<KpiGroup[]>([]);

	/** Selected KPI group id for dashboard filtering (null = all groups) */
	selectedGroupId = $state<string | null>(null);

	/** KPIs that have been assigned to a group */
	groupedKpis = $derived.by(() => {
		const set = new SvelteSet<string>();
		for (const g of this.kpiGroups) {
			for (const name of g.kpiNames) {
				set.add(name);
			}
		}
		return set;
	});

	/** KPIs not in any group */
	ungroupedKpis = $derived.by(() => {
		return this.kpiNames.filter((name) => !this.groupedKpis.has(name));
	});

	// ── Chart overlays ──
	/** Chart overlay configuration (primary KPI -> additional KPIs) */
	chartOverlays = $state<Map<string, string[]>>(new SvelteMap());

	// ── Focused chart ──
	focusedChart = $state<string | null>(null);

	// ── UI state ──
	sidebarOpen = $state(true);
	settingsOpen = $state(false);
	thresholdDialogOpen = $state(false);
	groupDialogOpen = $state(false);

	// ── Current view ──
	/** 'splash' | 'thresholds' | 'grouping' | 'dashboard' */
	view = $state<'splash' | 'thresholds' | 'grouping' | 'dashboard'>('splash');

	// ── Constructor ──
	constructor() {
		this.loadFromStorage();
	}

	// ── localStorage ──────────────────────────────────────────

	loadFromStorage() {
		if (typeof window === 'undefined') return;
		try {
			const thresholdsJson = localStorage.getItem(LS_THRESHOLDS);
			if (thresholdsJson) {
				const parsed = JSON.parse(thresholdsJson) as Record<string, Threshold>;
				const map = new SvelteMap<string, Threshold>();
				for (const [key, val] of Object.entries(parsed)) {
					map.set(key, val);
				}
				this.thresholds = map;
				this.thresholdsConfigured = map.size > 0;
			}

			const groupsJson = localStorage.getItem(LS_GROUPS);
			if (groupsJson) {
				this.kpiGroups = JSON.parse(groupsJson) as KpiGroup[];
			}

			const settingsJson = localStorage.getItem(LS_SETTINGS);
			if (settingsJson) {
				const settings = JSON.parse(settingsJson);
				if (typeof settings.globalDays === 'number') this.globalDays = settings.globalDays;
			}
		} catch {
			// Ignore parse errors
		}
	}

	saveToStorage() {
		if (typeof window === 'undefined') return;
		try {
			const thresholdsObj: Record<string, Threshold> = {};
			for (const [key, val] of this.thresholds) {
				thresholdsObj[key] = val;
			}
			localStorage.setItem(LS_THRESHOLDS, JSON.stringify(thresholdsObj));
			localStorage.setItem(LS_GROUPS, JSON.stringify(this.kpiGroups));
			localStorage.setItem(LS_SETTINGS, JSON.stringify({ globalDays: this.globalDays }));
		} catch {
			// Ignore storage errors
		}
	}

	/** Whether we have saved thresholds that can be reused */
	hasSavedSettings(): boolean {
		return this.thresholdsConfigured && this.thresholds.size > 0;
	}

	// ── View transitions ──────────────────────────────────────

	async openFocusedChart(kpiName: string) {
		if (typeof document !== 'undefined' && 'startViewTransition' in document) {
			(document as any).startViewTransition(async () => {
				this.focusedChart = kpiName;
				await tick();
			});
		} else {
			this.focusedChart = kpiName;
		}
	}

	async closeFocusedChart() {
		if (typeof document !== 'undefined' && 'startViewTransition' in document) {
			(document as any).startViewTransition(async () => {
				this.focusedChart = null;
				await tick();
			});
		} else {
			this.focusedChart = null;
		}
	}

	// ── Helpers ────────────────────────────────────────────────

	getDaysForKpi(kpiName: string): number {
		return (
			this.kpiDaysOverride.get(kpiName) ??
			this.areaDaysOverride.get(this.selectedArea) ??
			this.globalDays
		);
	}

	meetsThreshold(kpiName: string, value: number): boolean | null {
		const t = this.thresholds.get(kpiName);
		if (!t) return null;
		switch (t.operator) {
			case '>=':
				return value >= t.value;
			case '<=':
				return value <= t.value;
			case '>':
				return value > t.value;
			case '<':
				return value < t.value;
			case '==':
				return Math.abs(value - t.value) < 1e-9;
			case '!=':
				return Math.abs(value - t.value) >= 1e-9;
		}
	}

	getThresholdLabel(kpiName: string): string {
		const t = this.thresholds.get(kpiName);
		if (!t) return kpiName;
		return `${kpiName} ${t.operator} ${formatFloat(t.value)}`;
	}

	getKpiData(kpiName: string): KpiData | undefined {
		const area = this.data.get(this.selectedArea);
		if (!area) return undefined;
		return area.kpis.find((k) => k.name === kpiName);
	}

	getLatestValue(kpiName: string): number | null {
		const kpi = this.getKpiData(kpiName);
		if (!kpi || kpi.values.length === 0) return null;
		for (let i = kpi.values.length - 1; i >= 0; i--) {
			if (kpi.values[i].value !== null && !isNaN(kpi.values[i].value)) {
				return kpi.values[i].value;
			}
		}
		return null;
	}

	getFilteredValues(kpiName: string, daysOverride?: number): KpiDataPoint[] {
		const kpi = this.getKpiData(kpiName);
		if (!kpi) return [];
		const days = daysOverride ?? this.getDaysForKpi(kpiName);
		const cutoff = new Date();
		cutoff.setDate(cutoff.getDate() - days);
		// Filter and sort chronologically (oldest to newest)
		return kpi.values
			.filter((v) => v.date >= cutoff)
			.sort((a, b) => a.date.getTime() - b.date.getTime());
	}

	addOverlay(primaryKpi: string, additionalKpi: string) {
		const current = this.chartOverlays.get(primaryKpi) ?? [];
		if (!current.includes(additionalKpi)) {
			this.chartOverlays = new SvelteMap(this.chartOverlays).set(primaryKpi, [
				...current,
				additionalKpi
			]);
		}
	}

	removeOverlay(primaryKpi: string, additionalKpi: string) {
		const current = this.chartOverlays.get(primaryKpi) ?? [];
		this.chartOverlays = new SvelteMap(this.chartOverlays).set(
			primaryKpi,
			current.filter((k) => k !== additionalKpi)
		);
	}

	addGroup(name: string, kpiNames: string[]) {
		const id = crypto.randomUUID();
		this.kpiGroups = [...this.kpiGroups, { id, name, kpiNames }];
		this.saveToStorage();
	}

	removeGroup(id: string) {
		this.kpiGroups = this.kpiGroups.filter((g) => g.id !== id);
		this.saveToStorage();
	}

	updateGroup(id: string, updates: Partial<Omit<KpiGroup, 'id'>>) {
		this.kpiGroups = this.kpiGroups.map((g) => (g.id === id ? { ...g, ...updates } : g));
		this.saveToStorage();
	}

	/** Get summary stats for the dashboard */
	getStats(): { total: number; passing: number; failing: number; noThreshold: number } {
		let passing = 0;
		let failing = 0;
		let noThreshold = 0;

		for (const name of this.kpiNames) {
			const latest = this.getLatestValue(name);
			if (latest === null) {
				noThreshold++;
				continue;
			}
			const result = this.meetsThreshold(name, latest);
			if (result === null) noThreshold++;
			else if (result) passing++;
			else failing++;
		}

		return { total: this.kpiNames.length, passing, failing, noThreshold };
	}

	reset() {
		this.data = new SvelteMap();
		this.kpiNames = [];
		this.areaNames = [];
		this.chartOverlays = new SvelteMap();
		this.kpiDaysOverride = new SvelteMap();
		this.areaDaysOverride = new SvelteMap();
		this.focusedChart = null;
		this.selectedGroupId = null;
		this.view = 'splash';
		// Don't clear thresholds, groups, settings - they persist across files
	}

	clearAllSettings() {
		this.thresholds = new SvelteMap();
		this.thresholdsConfigured = false;
		this.kpiGroups = [];
		this.globalDays = 30;
		if (typeof window !== 'undefined') {
			localStorage.removeItem(LS_THRESHOLDS);
			localStorage.removeItem(LS_GROUPS);
			localStorage.removeItem(LS_SETTINGS);
		}
	}
}

// ── Context helpers ────────────────────────────────────────────

export function setAppState(): AppState {
	const state = new AppState();
	setContext(APP_STATE_KEY, state);
	return state;
}

export function useAppState(): AppState {
	return getContext<AppState>(APP_STATE_KEY);
}

// ── Utility ────────────────────────────────────────────────────

export function formatFloat(n: number): string {
	if (Number.isInteger(n)) return n.toString();
	return parseFloat(n.toFixed(4)).toString();
}

/** Generate a CSS-safe view-transition-name from a KPI name */
export function vtName(kpiName: string): string {
	return (
		'vt-' +
		kpiName
			.replace(/[()]/g, '')
			.replace(/\s+/g, '_')
			.replace(/[^a-zA-Z0-9_-]/g, '')
	);
}
