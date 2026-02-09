import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { url } = await request.json();

		if (!url || typeof url !== 'string') {
			return json({ error: 'URL is required' }, { status: 400 });
		}

		// Validate URL
		let parsedUrl: URL;
		try {
			parsedUrl = new URL(url);
		} catch {
			return json({ error: 'Invalid URL' }, { status: 400 });
		}

		// Only allow http/https
		if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
			return json({ error: 'Only HTTP/HTTPS URLs are supported' }, { status: 400 });
		}

		const response = await fetch(url, {
			headers: {
				'User-Agent': 'KPI-Dashboard/1.0'
			}
		});

		if (!response.ok) {
			return json(
				{ error: `Remote server returned ${response.status}: ${response.statusText}` },
				{ status: 502 }
			);
		}

		const buffer = await response.arrayBuffer();

		return new Response(buffer, {
			headers: {
				'Content-Type':
					response.headers.get('Content-Type') ??
					'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
			}
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error';
		return json({ error: message }, { status: 500 });
	}
};
