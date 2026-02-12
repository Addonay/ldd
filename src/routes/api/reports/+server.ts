import { json } from '@sveltejs/kit';
import { readdir } from 'fs/promises';
import { join } from 'path';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	try {
		const reportsDir = join(process.cwd(), 'static', 'reports');
		const files = await readdir(reportsDir);
		
		// Filter for Excel files only
		const excelFiles = files.filter(file => 
			file.toLowerCase().endsWith('.xlsx') || 
			file.toLowerCase().endsWith('.xls')
		);
		
		return json({ files: excelFiles });
	} catch (err) {
		// Directory doesn't exist or can't be read
		return json({ files: [] });
	}
};
