import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAssetTagById, updateAssetTag, deleteAssetTag } from '$lib/server/db/queries';
import type { NewAssetTag } from '$lib/server/db/schema';

// GET /api/asset-tags/[id]
export const GET: RequestHandler = async ({ params }) => {
	try {
		const id = parseInt(params.id);
		const tag = getAssetTagById(id);

		if (!tag) {
			return json({ error: 'Asset tag not found' }, { status: 404 });
		}

		return json(tag);
	} catch (error) {
		console.error('Error fetching asset tag:', error);
		return json({ error: 'Failed to fetch asset tag' }, { status: 500 });
	}
};

// PUT /api/asset-tags/[id]
export const PUT: RequestHandler = async ({ params, request }) => {
	try {
		const id = parseInt(params.id);
		const data = await request.json();

		const updateData: Partial<NewAssetTag> = {
			name: data.name,
			type: data.type ?? null,
			color: data.color ?? null
		};

		Object.keys(updateData).forEach(
			(key) => updateData[key as keyof NewAssetTag] === undefined && delete updateData[key as keyof NewAssetTag]
		);

		const tag = updateAssetTag(id, updateData);
		if (!tag) {
			return json({ error: 'Asset tag not found' }, { status: 404 });
		}

		return json(tag);
	} catch (error) {
		console.error('Error updating asset tag:', error);
		return json({ error: 'Failed to update asset tag' }, { status: 500 });
	}
};

// DELETE /api/asset-tags/[id]
export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const id = parseInt(params.id);
		const tag = deleteAssetTag(id);

		if (!tag) {
			return json({ error: 'Asset tag not found' }, { status: 404 });
		}

		return json({ success: true });
	} catch (error) {
		console.error('Error deleting asset tag:', error);
		return json({ error: 'Failed to delete asset tag' }, { status: 500 });
	}
};
