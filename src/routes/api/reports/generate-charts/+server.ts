import { json } from '@sveltejs/kit';
import { access, mkdir, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { basename, extname, join, resolve } from 'path';
import { spawn } from 'child_process';
import type { RequestHandler } from './$types';

interface ThresholdPayload {
	operator: '>=' | '<=' | '>' | '<' | '==' | '!=';
	value: number;
}

interface GeneratePayload {
	areas: Array<{
		name: string;
		kpis: Array<{
			name: string;
			values: Array<{ date: string; value: number }>;
		}>;
	}>;
	thresholds: Record<string, ThresholdPayload>;
	sourceReportFile: string | null;
}

function runPython(args: string[]): Promise<string> {
	return new Promise((resolve, reject) => {
		const process = spawn(args[0], args.slice(1), { windowsHide: true });
		let stdout = '';
		let stderr = '';

		process.stdout.on('data', (data) => {
			stdout += data.toString();
		});
		process.stderr.on('data', (data) => {
			stderr += data.toString();
		});
		process.on('error', (error) => reject(error));
		process.on('close', (code) => {
			if (code === 0) resolve(stdout.trim());
			else reject(new Error(stderr || `Python process exited with code ${code}`));
		});
	});
}

export const POST: RequestHandler = async ({ request }) => {
	let tempInputPath: string | null = null;
	try {
		const payload = (await request.json()) as GeneratePayload;

		if (!payload?.areas || !payload?.thresholds) {
			return json({ error: 'Invalid payload' }, { status: 400 });
		}

		const projectRoot = process.cwd();
		const scriptsDir = join(projectRoot, 'scripts');
		const scriptPath = join(scriptsDir, 'generate_kpi_charts.py');
		const venvPython = join(scriptsDir, '.venv', 'Scripts', 'python.exe');
		const systemPython = 'python';

		let pythonExe = systemPython;
		try {
			await access(venvPython);
			pythonExe = venvPython;
		} catch {
			pythonExe = systemPython;
		}

		tempInputPath = join(tmpdir(), `ldd-charts-input-${Date.now()}.json`);
		await writeFile(tempInputPath, JSON.stringify(payload), 'utf-8');

		const outputDir = join(projectRoot, 'static', 'reports', 'generated');
		await mkdir(outputDir, { recursive: true });

		const sourceFileName = payload.sourceReportFile ?? 'manual-upload.xlsx';
		const sourceBaseName = basename(sourceFileName, extname(sourceFileName));
		const outputFileName = `${sourceBaseName}_charts_${Date.now()}.xlsx`;
		const outputPath = join(outputDir, outputFileName);

		const reportsRoot = resolve(projectRoot, 'static', 'reports');
		let sourcePath: string | null = null;
		if (payload.sourceReportFile) {
			const candidate = resolve(reportsRoot, payload.sourceReportFile);
			if (!candidate.startsWith(reportsRoot)) {
				return json({ error: 'Invalid source report file path' }, { status: 400 });
			}
			sourcePath = candidate;
		}

		const pythonArgs = [pythonExe, scriptPath, '--input-json', tempInputPath, '--output', outputPath];
		if (sourcePath) {
			pythonArgs.push('--source', sourcePath);
		}

		const rawResult = await runPython(pythonArgs);
		const result = rawResult ? JSON.parse(rawResult) : {};

		return json({
			success: true,
			file: outputFileName,
			url: `/reports/generated/${outputFileName}`,
			meta: result
		});
	} catch (error) {
		return json(
			{ error: error instanceof Error ? error.message : 'Failed to generate charts workbook' },
			{ status: 500 }
		);
	} finally {
		if (tempInputPath) {
			await rm(tempInputPath, { force: true }).catch(() => undefined);
		}
	}
};
