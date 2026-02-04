<script lang="ts">
	import Modal from './Modal.svelte';
	import Button from '$lib/components/Button.svelte';
	import type { BillWithCategory } from '$lib/types/bill';
	import type { BillCycle } from '$lib/server/db/schema';
	import { format, endOfDay } from 'date-fns';

	interface Props {
		isOpen: boolean;
		bill: BillWithCategory | null;
		cycles?: BillCycle[];
		focusCycleId?: number | null;
		onConfirm: (amount: number, paymentDate: string, cycleId: number | null) => Promise<void>;
		onCancel: () => void;
	}

	let { isOpen = $bindable(), bill, cycles = [], focusCycleId = null, onConfirm, onCancel }: Props = $props();

	let amount = $state(0);
	let isSubmitting = $state(false);
	let paymentDate = $state('');
	let availableCycles = $state<BillCycle[]>([]);
	let selectedCycleId = $state<number | null>(null);

	function normalizeCycles(input: BillCycle[]): BillCycle[] {
		return input.map((cycle) => ({
			...cycle,
			startDate: cycle.startDate instanceof Date ? cycle.startDate : new Date(cycle.startDate),
			endDate: cycle.endDate instanceof Date ? cycle.endDate : new Date(cycle.endDate)
		}));
	}

	// Update amount when bill changes
	$effect(() => {
		if (bill) {
			amount = bill.amount;
			const today = new Date();
			const year = today.getFullYear();
			const month = String(today.getMonth() + 1).padStart(2, '0');
			const day = String(today.getDate()).padStart(2, '0');
			paymentDate = `${year}-${month}-${day}`;
		}
	});

	$effect(() => {
		if (!isOpen || !bill) return;

		if (cycles.length > 0) {
			const normalized = normalizeCycles(cycles);
			availableCycles = normalized;
			selectedCycleId = focusCycleId ?? normalized[0]?.id ?? null;
			return;
		}

		(async () => {
			try {
				const response = await fetch(`/api/bills/${bill.id}/cycles`);
				if (!response.ok) return;
				const data = (await response.json()) as BillCycle[];
				const normalized = normalizeCycles(data);
				availableCycles = normalized;

				const todayEnd = endOfDay(new Date());
				const unpaidPast = normalized
					.filter((cycle) => cycle.endDate <= todayEnd && !cycle.isPaid)
					.sort((a, b) => a.startDate.getTime() - b.startDate.getTime())[0];
				const current = normalized.find(
					(cycle) => cycle.startDate <= todayEnd && cycle.endDate >= todayEnd
				);

				selectedCycleId =
					focusCycleId ?? unpaidPast?.id ?? current?.id ?? normalized[0]?.id ?? null;
			} catch (error) {
				console.error('Failed to load cycles', error);
			}
		})();
	});

	async function handleSubmit(e: Event) {
		e.preventDefault();
		isSubmitting = true;

		try {
			await onConfirm(parseFloat(amount.toString()), paymentDate, selectedCycleId);
		} finally {
			isSubmitting = false;
		}
	}
</script>

{#if bill}
	<Modal bind:isOpen onClose={onCancel} title="Confirm Payment">
		<form onsubmit={handleSubmit} class="space-y-4">
			<div>
				{#if availableCycles.length > 0}
					<label for="paymentCycle" class="block text-sm font-medium text-gray-700 mb-1">
						Apply To Cycle <span class="text-red-500">*</span>
					</label>
					<select
						id="paymentCycle"
						bind:value={selectedCycleId}
						required
						class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 mb-4"
					>
						{#each availableCycles as cycle}
							<option value={cycle.id}>
								{format(cycle.startDate, 'MMM d, yyyy')} – {format(cycle.endDate, 'MMM d, yyyy')}
								{cycle.isPaid ? ' (Paid)' : ''}
							</option>
						{/each}
					</select>
				{/if}

				<p class="text-sm text-gray-600 mb-4">
					You're marking <span class="font-semibold text-gray-900">{bill.name}</span> as paid.
				</p>

				<label for="paymentAmount" class="block text-sm font-medium text-gray-700 mb-1">
					Payment Amount <span class="text-red-500">*</span>
				</label>
				<div class="relative">
					<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
						<span class="text-gray-500">$</span>
					</div>
					<input
						type="number"
						id="paymentAmount"
						bind:value={amount}
						required
						min="0"
						step="0.01"
						class="block w-full rounded-md border-gray-300 pl-7 shadow-sm focus:border-blue-500 focus:ring-blue-500"
						placeholder="0.00"
					/>
				</div>
				<p class="mt-1 text-xs text-gray-500">
					Original bill amount: ${bill.amount.toFixed(2)}
				</p>
			</div>

			<div>
				<label for="paymentDate" class="block text-sm font-medium text-gray-700 mb-1">
					Payment Date <span class="text-red-500">*</span>
				</label>
				<input
					type="date"
					id="paymentDate"
					bind:value={paymentDate}
					required
					class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
				/>
			</div>

			<!-- Actions -->
			<div class="flex items-center justify-end gap-3 border-t border-gray-200 pt-4">
				<Button
					variant="secondary"
					size="md"
					onclick={onCancel}
					disabled={isSubmitting}
				>
					Cancel
				</Button>
				<Button
					type="submit"
					variant="primary"
					size="md"
					disabled={isSubmitting}
				>
					{isSubmitting ? 'Confirming...' : 'Confirm Payment'}
				</Button>
			</div>
		</form>
	</Modal>
{/if}
