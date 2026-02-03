import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPaymentMethodById, updatePaymentMethod, deletePaymentMethod } from '$lib/server/db/queries';
import type { NewPaymentMethod } from '$lib/server/db/schema';

// GET /api/payment-methods/[id]
export const GET: RequestHandler = async ({ params }) => {
	try {
		const id = parseInt(params.id);
		const method = getPaymentMethodById(id);

		if (!method) {
			return json({ error: 'Payment method not found' }, { status: 404 });
		}

		return json(method);
	} catch (error) {
		console.error('Error fetching payment method:', error);
		return json({ error: 'Failed to fetch payment method' }, { status: 500 });
	}
};

// PUT /api/payment-methods/[id]
export const PUT: RequestHandler = async ({ params, request }) => {
	try {
		const id = parseInt(params.id);
		const data = await request.json();

		const updateData: Partial<NewPaymentMethod> = {
			nickname: data.nickname,
			lastFour: data.lastFour
		};

		Object.keys(updateData).forEach(
			(key) => updateData[key as keyof NewPaymentMethod] === undefined && delete updateData[key as keyof NewPaymentMethod]
		);

		const method = updatePaymentMethod(id, updateData);
		if (!method) {
			return json({ error: 'Payment method not found' }, { status: 404 });
		}

		return json(method);
	} catch (error) {
		console.error('Error updating payment method:', error);
		return json({ error: 'Failed to update payment method' }, { status: 500 });
	}
};

// DELETE /api/payment-methods/[id]
export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const id = parseInt(params.id);
		const method = deletePaymentMethod(id);

		if (!method) {
			return json({ error: 'Payment method not found' }, { status: 404 });
		}

		return json({ success: true });
	} catch (error) {
		console.error('Error deleting payment method:', error);
		return json({ error: 'Failed to delete payment method' }, { status: 500 });
	}
};
