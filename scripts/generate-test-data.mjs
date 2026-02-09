// Generate a test Excel file with single-sheet format (areas separated by empty rows)
import * as XLSX from 'xlsx';
import { writeFileSync } from 'fs';

const AREAS = ['Kenya', 'Nairobi', 'Mombasa', 'Nakuru', 'Kisumu', 'Eldoret'];

const KPIS = [
	'2G RNA',
	'3G RNA',
	'4G RNA',
	'5G RNA',
	'2G CSSR',
	'3G CSSR',
	'4G CSSR',
	'2G DCR',
	'3G DCR',
	'4G DCR',
	'DL Throughput',
	'UL Throughput',
	'VOLTE CSSR',
	'VOLTE DCR',
	'Data Traffic (TB)',
	'Voice Traffic (Erl)',
	'LTE Attach SR',
	'Paging SR',
	'SRVCC SR',
	'HO SR',
	'RRC SR',
	'ERAB SR'
];

// Generate dates for last 180 days
function getDates(count) {
	const dates = [];
	const now = new Date();
	for (let i = count - 1; i >= 0; i--) {
		const d = new Date(now);
		d.setDate(d.getDate() - i);
		dates.push(d);
	}
	return dates;
}

function formatDate(d) {
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Generate realistic KPI values
function generateValues(kpiName, days, areaIdx) {
	const baseValues = {
		'2G RNA': 99.5,
		'3G RNA': 99.3,
		'4G RNA': 99.7,
		'5G RNA': 99.1,
		'2G CSSR': 99.8,
		'3G CSSR': 99.6,
		'4G CSSR': 99.9,
		'2G DCR': 0.3,
		'3G DCR': 0.4,
		'4G DCR': 0.2,
		'DL Throughput': 25.5,
		'UL Throughput': 8.3,
		'VOLTE CSSR': 99.7,
		'VOLTE DCR': 0.15,
		'Data Traffic (TB)': 450.2,
		'Voice Traffic (Erl)': 12500,
		'LTE Attach SR': 99.85,
		'Paging SR': 99.92,
		'SRVCC SR': 98.5,
		'HO SR': 99.1,
		'RRC SR': 99.95,
		'ERAB SR': 99.88
	};

	const base = baseValues[kpiName] || 99.0;
	const values = [];
	let current = base + (areaIdx * 0.05 - 0.1);

	for (let i = 0; i < days; i++) {
		// Random walk with mean reversion
		const noise = (Math.random() - 0.5) * 0.3;
		current = current + noise * 0.1 + (base - current) * 0.05;
		// Add occasional dips
		if (Math.random() < 0.03) {
			current -= Math.random() * 1.5;
		}
		values.push(Math.round(current * 10000) / 10000);
	}
	return values;
}

const wb = XLSX.utils.book_new();
const dates = getDates(180);
const rows = [];

// Header row: KE | KPI Name | date1 | date2 | ...
const header = ['KE', 'KPI Name', ...dates.map(formatDate)];
rows.push(header);

for (let areaIdx = 0; areaIdx < AREAS.length; areaIdx++) {
	const area = AREAS[areaIdx];

	// First area (Kenya) has NO area name header — data starts right after header.
	// Subsequent areas: add empty row, then area name row.
	if (areaIdx > 0) {
		rows.push([]); // empty separator row
		rows.push([area]); // area name row
	}

	// KPI data rows
	for (let k = 0; k < KPIS.length; k++) {
		const kpiName = KPIS[k];
		const values = generateValues(kpiName, 180, areaIdx);
		rows.push(['KE', kpiName, ...values]);
	}
}

// Use the first area name as the sheet name (it will be used as the default area name)
const ws = XLSX.utils.aoa_to_sheet(rows);
XLSX.utils.book_append_sheet(wb, ws, AREAS[0]);

const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
writeFileSync('/home/addo/dev/side/ldd/static/test-data.xlsx', buf);
console.log(
	'Generated test-data.xlsx: single sheet with',
	AREAS.length,
	'areas and',
	KPIS.length,
	'KPIs'
);
