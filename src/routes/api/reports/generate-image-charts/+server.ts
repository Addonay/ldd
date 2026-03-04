import { json } from '@sveltejs/kit';
import { mkdir, writeFile } from 'fs/promises';
import { basename, join, resolve } from 'path';
import ExcelJS from 'exceljs';
import type { RequestHandler } from './$types';

interface ImageChartPayload {
	kpiName: string;
	title: string;
	thresholdText: string;
	imageBase64: string;
}

interface GenerateImageChartsPayload {
	areaName?: string;
	days: number;
	sourceReportFile: string | null;
	charts?: ImageChartPayload[];
	areas?: Array<{
		name: string;
		charts: ImageChartPayload[];
	}>;
}

const CHART_START_COLS = [1, 10, 19];
const CHARTS_PER_ROW = 3;
const ROW_HEIGHT_BLOCK = 14;
const CHART_IMAGE_WIDTH = 640;
const CHART_IMAGE_HEIGHT = 300;

export const POST: RequestHandler = async ({ request }) => {
	try {
		const payload = (await request.json()) as GenerateImageChartsPayload;

		const normalizedAreas = Array.isArray(payload.areas) && payload.areas.length > 0
			? payload.areas.filter((area) => Array.isArray(area.charts) && area.charts.length > 0)
			: payload.charts && Array.isArray(payload.charts) && payload.charts.length > 0
				? [{ name: payload.areaName ?? 'Unknown Area', charts: payload.charts }]
				: [];

		if (normalizedAreas.length === 0) {
			return json({ error: 'No chart images provided' }, { status: 400 });
		}

		const workbook = new ExcelJS.Workbook();
		const projectRoot = process.cwd();
		const reportsRoot = resolve(projectRoot, 'static', 'reports');
		const generatedDir = join(reportsRoot, 'generated');
		await mkdir(generatedDir, { recursive: true });

		let outputFileName = 'manual-upload.xlsx';

		if (payload.sourceReportFile) {
			const sourcePath = resolve(reportsRoot, payload.sourceReportFile);
			if (!sourcePath.startsWith(reportsRoot)) {
				return json({ error: 'Invalid source report file path' }, { status: 400 });
			}

			await workbook.xlsx.readFile(sourcePath);
			outputFileName = basename(payload.sourceReportFile);
		}

		const existingChartsSheet = workbook.getWorksheet('Charts');
		if (existingChartsSheet) {
			workbook.removeWorksheet(existingChartsSheet.id);
		}

		const chartsWs = workbook.addWorksheet('Charts');

		for (let col = 1; col <= 24; col++) {
			chartsWs.getColumn(col).width = 11;
		}
		chartsWs.views = [{ state: 'frozen', ySplit: 2 }];

		let rowCursor = 1;
		for (const area of normalizedAreas) {
			chartsWs.mergeCells(`A${rowCursor}:X${rowCursor + 1}`);
			const titleCell = chartsWs.getCell(`A${rowCursor}`);
			titleCell.value = `${(area.name || 'Unknown Area').toUpperCase()} • LAST ${payload.days} DAYS`;
			titleCell.font = { name: 'Calibri', bold: true, size: 16, color: { argb: 'FF111111' } };
			titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
			chartsWs.getRow(rowCursor).height = 26;
			chartsWs.getRow(rowCursor + 1).height = 18;

			const gridStartRow = rowCursor + 3;
			const usedRows = Math.ceil(area.charts.length / CHARTS_PER_ROW) * ROW_HEIGHT_BLOCK;
			for (let row = gridStartRow; row < gridStartRow + usedRows; row++) {
				chartsWs.getRow(row).height = 18;
			}

			for (let index = 0; index < area.charts.length; index++) {
				const chartItem = area.charts[index];
				const imageBase64 = chartItem.imageBase64?.trim();
				if (!imageBase64) continue;

				const imageId = workbook.addImage({
					base64: imageBase64,
					extension: 'png'
				});

				const gridRow = Math.floor(index / CHARTS_PER_ROW);
				const gridCol = index % CHARTS_PER_ROW;
				const anchorRow = gridStartRow + gridRow * ROW_HEIGHT_BLOCK;
				const anchorCol = CHART_START_COLS[gridCol];

				chartsWs.addImage(imageId, {
					tl: { col: anchorCol - 1 + 0.06, row: anchorRow - 1 + 0.08 },
					ext: { width: CHART_IMAGE_WIDTH, height: CHART_IMAGE_HEIGHT }
				});
			}

			rowCursor = gridStartRow + usedRows + 2;
		}

		const outputPath = join(generatedDir, outputFileName);

		const buffer = await workbook.xlsx.writeBuffer();
		await writeFile(outputPath, Buffer.from(buffer));

		return json({
			success: true,
			file: outputFileName,
			url: `/reports/generated/${outputFileName}`,
			meta: {
				charts_embedded: normalizedAreas.reduce((total, area) => total + area.charts.length, 0),
				areas_embedded: normalizedAreas.length,
				days: payload.days
			}
		});
	} catch (error) {
		return json(
			{ error: error instanceof Error ? error.message : 'Failed to generate image charts workbook' },
			{ status: 500 }
		);
	}
};
