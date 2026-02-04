import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAllPaymentMethods, createPaymentMethod } from '$lib/server/db/queries';
import type { NewPaymentMethod } from '$lib/server/db/schema';

// GET /api/payment-methods - Get all payment methods
export const GET: RequestHandler = async () => {
	try {
		const methods = getAllPaymentMethods();
		return json(methods);
	} catch (error) {
		console.error('Error fetching payment methods:', error);
		return json({ error: 'Failed to fetch payment methods' }, { status: 500 });
	}
};

// POST /api/payment-methods - Create a payment method
export const POST: RequestHandler = async ({ request }) => {
	try {
		const data = await request.json();

		if (!data.nickname || !data.lastFour) {
			return json({ error: 'Missing required fields' }, { status: 400 });
		}

		const newMethod: NewPaymentMethod = {
			nickname: data.nickname,
			lastFour: data.lastFour,
			type: data.type || null
		};

		const method = createPaymentMethod(newMethod);
		return json(method, { status: 201 });
	} catch (error) {
		console.error('Error creating payment method:', error);
		return json({ error: 'Failed to create payment method' }, { status: 500 });
	}
};
