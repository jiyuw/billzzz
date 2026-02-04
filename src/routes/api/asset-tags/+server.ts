import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAllAssetTags, createAssetTag } from '$lib/server/db/queries';
import type { NewAssetTag } from '$lib/server/db/schema';

// GET /api/asset-tags
export const GET: RequestHandler = async () => {
	try {
		const tags = getAllAssetTags();
		return json(tags);
	} catch (error) {
		console.error('Error fetching asset tags:', error);
		return json({ error: 'Failed to fetch asset tags' }, { status: 500 });
	}
};

// POST /api/asset-tags
export const POST: RequestHandler = async ({ request }) => {
	try {
		const data = await request.json();
		if (!data.name) {
			return json({ error: 'Missing required fields' }, { status: 400 });
		}

		const newTag: NewAssetTag = {
			name: data.name,
			type: data.type || null,
			color: data.color || null
		};

		const tag = createAssetTag(newTag);
		return json(tag, { status: 201 });
	} catch (error) {
		console.error('Error creating asset tag:', error);
		return json({ error: 'Failed to create asset tag' }, { status: 500 });
	}
};
