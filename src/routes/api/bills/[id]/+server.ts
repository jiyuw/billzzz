import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getBillById, updateBill, deleteBill, markBillAsPaid } from '$lib/server/db/queries';
import { createPayment, createPaymentForCycle, getFocusCycleForBill } from '$lib/server/db/bill-queries';
import { calculateNextDueDate } from '$lib/server/utils/recurrence';
import { parseLocalDate } from '$lib/utils/dates';
import { endOfDay } from 'date-fns';

// GET /api/bills/[id] - Get a single bill
export const GET: RequestHandler = async ({ params }) => {
	try {
		const id = parseInt(params.id);
		const bill = getBillById(id);

		if (!bill) {
			return json({ error: 'Bill not found' }, { status: 404 });
		}

		return json(bill);
	} catch (error) {
		console.error('Error fetching bill:', error);
		return json({ error: 'Failed to fetch bill' }, { status: 500 });
	}
};

// PUT /api/bills/[id] - Update a bill
export const PUT: RequestHandler = async ({ params, request }) => {
	try {
		const id = parseInt(params.id);
		const data = await request.json();

		// Handle both ISO timestamp and YYYY-MM-DD formats for dueDate
		let parsedDueDate: Date | undefined;
		if (data.dueDate) {
			try {
				if (data.dueDate.includes('T')) {
					// ISO timestamp format: "2025-10-31T05:00:00.000Z"
					parsedDueDate = endOfDay(new Date(data.dueDate));
				} else {
					// YYYY-MM-DD format
					parsedDueDate = endOfDay(parseLocalDate(data.dueDate));
				}
			} catch (error) {
				console.error('Error parsing due date:', { dueDate: data.dueDate, error });
				return json({ error: 'Invalid due date format. Expected YYYY-MM-DD' }, { status: 400 });
			}
		}

		const parsedPaymentMethodId = data.paymentMethodId ? parseInt(data.paymentMethodId) : undefined;
		const normalizedPaymentMethodId = Number.isNaN(parsedPaymentMethodId) ? undefined : parsedPaymentMethodId;

		const updateData: any = {
			name: data.name,
			amount: data.amount ? parseFloat(data.amount) : undefined,
			dueDate: parsedDueDate,
			paymentLink: data.paymentLink,
			categoryId: data.categoryId,
			assetTagId: data.assetTagId ? parseInt(data.assetTagId) : undefined,
			isRecurring: data.isRecurring,
			recurrenceInterval: data.recurrenceInterval ? parseInt(data.recurrenceInterval) : undefined,
			recurrenceUnit: data.recurrenceUnit,
			recurrenceDay: data.recurrenceDay ? parseInt(data.recurrenceDay) : undefined,
			isPaid: data.isPaid,
			isAutopay: data.isAutopay,
			paymentMethodId: normalizedPaymentMethodId,
			isVariable: data.isVariable,
			notes: data.notes
		};
		if (data.isRecurring === false) {
			updateData.recurrenceInterval = null;
			updateData.recurrenceUnit = null;
			updateData.recurrenceDay = null;
		}
		if (data.isAutopay === false) {
			updateData.paymentMethodId = null;
		}

		// Remove undefined values
		Object.keys(updateData).forEach(
			(key) => updateData[key] === undefined && delete updateData[key]
		);

		const bill = updateBill(id, updateData);

		if (!bill) {
			return json({ error: 'Bill not found' }, { status: 404 });
		}

		return json(bill);
	} catch (error) {
		console.error('Error updating bill:', error);
		return json({ error: 'Failed to update bill' }, { status: 500 });
	}
};

// DELETE /api/bills/[id] - Delete a bill
export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const id = parseInt(params.id);
		const bill = deleteBill(id);

		if (!bill) {
			return json({ error: 'Bill not found' }, { status: 404 });
		}

		return json({ success: true });
	} catch (error) {
		console.error('Error deleting bill:', error);
		return json({ error: 'Failed to delete bill' }, { status: 500 });
	}
};

// PATCH /api/bills/[id] - Mark bill as paid/unpaid
export const PATCH: RequestHandler = async ({ params, request }) => {
	try {
		const id = parseInt(params.id);
		const { isPaid, paymentAmount, paymentDate, paymentCycleId } = await request.json();

		const currentBill = getBillById(id);
		if (!currentBill) {
			return json({ error: 'Bill not found' }, { status: 404 });
		}

		// If marking as paid, create payment in the current cycle
		if (isPaid) {
			const amountPaid = paymentAmount !== undefined ? parseFloat(paymentAmount) : currentBill.amount;
			const note = amountPaid !== currentBill.amount
				? `Payment recorded. Original amount: $${currentBill.amount.toFixed(2)}`
				: 'Payment recorded';
			const parsedPaymentDate = paymentDate ? parseLocalDate(paymentDate) : new Date();
			const cycleId = paymentCycleId ? parseInt(paymentCycleId) : null;
			if (cycleId) {
				await createPaymentForCycle(
					{
						billId: id,
						amount: amountPaid,
						paymentDate: parsedPaymentDate,
						notes: note
					},
					cycleId
				);
			} else {
				await createPayment({
					billId: id,
					amount: amountPaid,
					paymentDate: parsedPaymentDate,
					notes: note
				});
			}
		}

		if (isPaid) {
			const focusCycle = await getFocusCycleForBill(id);
			let shouldMarkPaid = false;
			if (focusCycle) {
				if (currentBill.isVariable) {
					shouldMarkPaid = focusCycle.totalPaid > 0 || focusCycle.isPaid;
				} else {
					shouldMarkPaid = focusCycle.isPaid || focusCycle.totalPaid >= focusCycle.expectedAmount;
				}
			}
			const bill = updateBill(id, { isPaid: shouldMarkPaid });
			return json(bill);
		}

		// Do not auto-advance due dates. Just mark as unpaid.
		const bill = markBillAsPaid(id, false);
		return json(bill);
	} catch (error) {
		console.error('Error updating bill status:', error);
		return json({ error: 'Failed to update bill status' }, { status: 500 });
	}
};
