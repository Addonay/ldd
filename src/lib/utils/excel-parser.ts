import * as XLSX from 'xlsx';
import type { AreaData, KpiData, KpiDataPoint } from '$lib/stores/app-state.svelte';

const MAX_SOURCE_ROW = 403;

/**
 * Parse an Excel file buffer into area data.
 *
 * Expected structure — SINGLE SHEET format:
 * - Row 1: Header row with dates starting from column C (index 2)
 * - Row 2+: KPI data rows for the first area (no area name header — defaults to sheet name)
 *   - Column A (index 0): code like "KE" (ignored)
 *   - Column B (index 1): KPI name
 *   - Columns C+ (index 2+): Numeric values for each date
 * - After the first area's KPIs: 1 empty row, then a row with the area name in a cell,
 *   then KPI data rows for that area, repeat for each additional area.
 *
 * Returns areas, kpiNames, and areaNames.
 */
export function parseExcelBuffer(buffer: ArrayBuffer): {
	areas: Map<string, AreaData>;
	kpiNames: string[];
	areaNames: string[];
} {
	const workbook = XLSX.read(buffer, { type: 'array', cellDates: true, cellNF: true });
	const areas = new Map<string, AreaData>();
	const kpiNames: string[] = [];
	const areaNames: string[] = [];

	// Use the first sheet
	const sheetName = workbook.SheetNames[0];
	if (!sheetName) return { areas, kpiNames, areaNames };

	const sheet = workbook.Sheets[sheetName];
	const allRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
		header: 1,
		raw: true,
		defval: null
	});
	const raw = allRows.slice(0, MAX_SOURCE_ROW);

	if (raw.length < 2) return { areas, kpiNames, areaNames };

	// Row 0 is the header — parse dates from column C onwards
	const headerRow = raw[0];
	if (!headerRow || headerRow.length < 3) return { areas, kpiNames, areaNames };

	const dates: (Date | null)[] = [];
	for (let col = 2; col < headerRow.length; col++) {
		dates.push(parseDate(headerRow[col]));
	}

	// Split the remaining rows into area blocks.
	// The first block has NO area name header — its name defaults to the sheet name.
	// Subsequent blocks are separated by: empty row, then a row with an area name.

	const blocks = splitIntoAreaBlocks(raw, sheetName);

	for (const block of blocks) {
		const areaData = parseAreaBlock(block.rows, block.areaName, dates);
		if (areaData && areaData.kpis.length > 0) {
			areas.set(block.areaName, areaData);
			areaNames.push(block.areaName);
			// Use the first area's KPI names as the canonical list
			if (kpiNames.length === 0) {
				for (const kpi of areaData.kpis) {
					kpiNames.push(kpi.name);
				}
			}
		}
	}

	return { areas, kpiNames, areaNames };
}

interface AreaBlock {
	areaName: string;
	rows: unknown[][];
}

/**
 * Split raw rows (excluding header at index 0) into area blocks.
 * First block: starts at row 1, area name = defaultAreaName.
 * Subsequent blocks: after an empty row, the next row's first non-empty cell is the area name.
 */
function splitIntoAreaBlocks(raw: unknown[][], defaultAreaName: string): AreaBlock[] {
	const blocks: AreaBlock[] = [];
	let currentName = defaultAreaName;
	let currentRows: unknown[][] = [];
	let expectingAreaName = false;

	for (let i = 1; i < raw.length; i++) {
		const row = raw[i];

		if (isEmptyRow(row)) {
			// Save current block if it has rows
			if (currentRows.length > 0) {
				blocks.push({ areaName: currentName, rows: currentRows });
				currentRows = [];
			}
			expectingAreaName = true;
			continue;
		}

		if (expectingAreaName) {
			// This row should contain the area name
			const areaName = extractAreaName(row);
			if (areaName) {
				currentName = areaName;
				expectingAreaName = false;
				// Check if this row ALSO has KPI data (area name in col A/B, KPI in col C)
				const kpiName = getKpiName(row);
				if (!kpiName) {
					// Pure area name row — skip it, next rows are KPI data
					continue;
				}
				// If the row has a KPI name too, it's a data row (the area name is just col A/B)
				// Fall through to add as data row
			}
			expectingAreaName = false;
		}

		// Check if this is a KPI data row (has a KPI name in column C)
		const kpiName = getKpiName(row);
		if (kpiName) {
			currentRows.push(row);
		}
	}

	// Don't forget the last block
	if (currentRows.length > 0) {
		blocks.push({ areaName: currentName, rows: currentRows });
	}

	return blocks;
}

function isEmptyRow(row: unknown[] | undefined): boolean {
	if (!row || row.length === 0) return true;
	return row.every((cell) => {
		if (cell === null || cell === undefined) return true;
		if (typeof cell === 'string' && cell.trim() === '') return true;
		return false;
	});
}

function extractAreaName(row: unknown[]): string | null {
	// Look for the first non-empty string cell in the row
	for (const cell of row) {
		if (cell !== null && cell !== undefined) {
			const s = String(cell).trim();
			if (s && isNaN(Number(s))) {
				return s;
			}
		}
	}
	return null;
}

function getKpiName(row: unknown[]): string | null {
	if (!row || row.length < 3) return null;
	const cell = row[1]; // Column B (index 1)
	if (cell === null || cell === undefined) return null;
	const s = String(cell).trim();
	return s || null;
}

function parseAreaBlock(
	rows: unknown[][],
	areaName: string,
	dates: (Date | null)[]
): AreaData | null {
	const kpis: KpiData[] = [];

	for (const row of rows) {
		const kpiName = getKpiName(row);
		if (!kpiName) continue;

		const values: KpiDataPoint[] = [];
		for (let col = 2; col < Math.min(row.length, dates.length + 2); col++) {
			const dateIdx = col - 2;
			const date = dates[dateIdx];
			if (!date || isNaN(date.getTime())) continue;

			const rawVal = row[col];
			const value = parseFloatSafe(rawVal);

			if (value !== null) {
				values.push({ date, value });
			}
		}

		if (values.length > 0) {
			values.sort((a, b) => a.date.getTime() - b.date.getTime());
			kpis.push({ name: kpiName, values });
		}
	}

	if (kpis.length === 0) return null;
	return { name: areaName, kpis };
}

function makeDateOnly(year: number, month: number, day: number): Date | null {
	const date = new Date(year, month - 1, day, 12, 0, 0, 0);
	if (
		isNaN(date.getTime()) ||
		date.getFullYear() !== year ||
		date.getMonth() !== month - 1 ||
		date.getDate() !== day
	) {
		return null;
	}
	return date;
}

export function parseDate(val: unknown): Date | null {
	if (val instanceof Date) {
		if (isNaN(val.getTime())) return null;
		// Excel date cells are date-only; normalize via UTC Y-M-D to avoid timezone day shifts
		return makeDateOnly(val.getUTCFullYear(), val.getUTCMonth() + 1, val.getUTCDate());
	}
	if (typeof val === 'number') {
		// Excel serial date
		const d = XLSX.SSF.parse_date_code(val);
		if (d) {
			return makeDateOnly(d.y, d.m, d.d);
		}
	}
	if (typeof val === 'string') {
		const s = val.trim();
		if (!s) return null;

		// Expected format in source files: DD-MM-YYYY (also accepts / or . separators)
		const dmyMatch = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/.exec(s);
		if (dmyMatch) {
			const day = Number(dmyMatch[1]);
			const month = Number(dmyMatch[2]);
			const year = Number(dmyMatch[3]);
			return makeDateOnly(year, month, day);
		}

		// Also support explicit ISO-like YYYY-MM-DD if present
		const ymdMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
		if (ymdMatch) {
			const year = Number(ymdMatch[1]);
			const month = Number(ymdMatch[2]);
			const day = Number(ymdMatch[3]);
			return makeDateOnly(year, month, day);
		}

		// Last fallback for uncommon textual date strings
		const parsed = new Date(s);
		if (!isNaN(parsed.getTime())) return parsed;
	}
	return null;
}

function parseFloatSafe(val: unknown): number | null {
	if (val === null || val === undefined || val === '') return null;
	if (typeof val === 'number') {
		return isNaN(val) ? null : val;
	}
	if (typeof val === 'string') {
		// Remove percentage signs, commas, spaces
		const cleaned = val.replace(/[%,\s]/g, '').trim();
		if (!cleaned) return null;
		const n = Number(cleaned);
		return isNaN(n) ? null : n;
	}
	return null;
}

/**
 * Fetch an Excel file from a URL (via our proxy endpoint)
 */
export async function fetchExcelFromUrl(url: string): Promise<ArrayBuffer> {
	const res = await fetch('/api/proxy', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ url })
	});

	if (!res.ok) {
		const msg = await res.text();
		throw new Error(`Failed to fetch spreadsheet: ${msg}`);
	}

	return res.arrayBuffer();
}
