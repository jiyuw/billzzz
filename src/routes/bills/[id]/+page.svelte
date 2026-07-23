<script lang="ts">
	import type { PageData } from './$types';
	import type { BillPayment } from '$lib/server/db/schema';
	import { invalidateAll, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import Button from '$lib/components/Button.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import BillForm from '$lib/components/BillForm.svelte';
	import PaymentModal from '$lib/components/PaymentModal.svelte';
	import CycleSelector from '$lib/components/CycleSelector.svelte';
	import { createCyclePlaceholder, getLatestCycle } from '$lib/utils/manual-cycles';
	import { formatCurrency } from '$lib/utils/format';
	import {
		formatStoredDate,
		formatStoredDateForInput
	} from '$lib/utils/dates';
	import { getRecurrenceDescription } from '$lib/utils/recurrence';

	let { data }: { data: PageData } = $props();

	const bill = $derived(data.bill);
	const cycles = $derived(data.cycles);
	const payments = $derived(data.payments);

	let selectedCycleId = $state<number | null>(null);
	let isAddingCycle = $state(false);
	let cycleStartDate = $state('');
	let cycleEndDate = $state('');
	let isSavingCycle = $state(false);
	let cycleError = $state('');
	let isPaymentModalOpen = $state(false);
	let editingPayment = $state<BillPayment | null>(null);
	let isEditBillOpen = $state(false);
	let editError = $state('');

	$effect(() => {
		const cycleParam = page.url.searchParams.get('cycle');
		const requestedCycleId = Number(cycleParam);
		if (
			cycleParam !== null &&
			Number.isInteger(requestedCycleId) &&
			requestedCycleId > 0 &&
			cycles.some((cycle) => cycle.id === requestedCycleId)
		) {
			selectedCycleId = requestedCycleId;
			return;
		}
		selectedCycleId = getLatestCycle(cycles)?.id ?? null;
	});

	function selectCycle(cycleId: number) {
		selectedCycleId = cycleId;
		const url = new URL(page.url);
		url.searchParams.set('cycle', String(cycleId));
		replaceState(url, page.state);
	}

	const selectedCycle = $derived(
		cycles.find((cycle) => cycle.id === selectedCycleId) ?? null
	);
	const selectedPayments = $derived(
		selectedCycle
			? payments.filter((payment) => payment.cycleId === selectedCycle.id)
			: []
	);
	const selectedRemaining = $derived(
		selectedCycle && !bill.isVariable
			? Math.max(selectedCycle.expectedAmount - selectedCycle.totalPaid, 0)
			: null
	);
	const selectedPercent = $derived(
		selectedCycle && selectedCycle.expectedAmount > 0
			? Math.min((selectedCycle.totalPaid / selectedCycle.expectedAmount) * 100, 100)
			: 0
	);

	function openAddCycle() {
		const placeholder = createCyclePlaceholder({
			cycles,
			isRecurring: bill.isRecurring,
			recurrenceInterval: bill.recurrenceInterval,
			recurrenceUnit: bill.recurrenceUnit,
			today: new Date()
		});
		cycleStartDate = formatStoredDateForInput(placeholder.startDate);
		cycleEndDate = formatStoredDateForInput(placeholder.endDate);
		cycleError = '';
		isAddingCycle = true;
	}

	async function addCycle(event: SubmitEvent) {
		event.preventDefault();
		isSavingCycle = true;
		cycleError = '';
		try {
			const response = await fetch(`/api/bills/${bill.id}/cycles`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					startDate: cycleStartDate,
					endDate: cycleEndDate
				})
			});
			const result = await response.json().catch(() => null);
			if (!response.ok) {
				cycleError = result?.error ?? 'Failed to add cycle.';
				return;
			}
			selectCycle(result.cycle.id);
			isAddingCycle = false;
			await invalidateAll();
		} finally {
			isSavingCycle = false;
		}
	}

	async function resizeCycle(input: {
		cycleId: number;
		side: 'start' | 'end';
		date: string;
	}) {
		isSavingCycle = true;
		cycleError = '';
		try {
			const response = await fetch(
				`/api/bills/${bill.id}/cycles/${input.cycleId}`,
				{
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ side: input.side, date: input.date })
				}
			);
			const result = await response.json().catch(() => null);
			if (!response.ok) {
				cycleError = result?.error ?? 'Failed to adjust cycle.';
				return;
			}
			await invalidateAll();
		} finally {
			isSavingCycle = false;
		}
	}

	function openAddPayment() {
		editingPayment = null;
		isPaymentModalOpen = true;
	}

	function openEditPayment(payment: BillPayment) {
		editingPayment = payment;
		isPaymentModalOpen = true;
	}

	async function savePayment(input: {
		amount: number;
		paymentDate: string;
		cycleId: number | null;
		notes?: string;
	}) {
		if (input.cycleId === null) return;
		const url = editingPayment
			? `/api/payments/${editingPayment.id}`
			: `/api/bills/${bill.id}/payments`;
		const response = await fetch(url, {
			method: editingPayment ? 'PUT' : 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(input)
		});
		if (!response.ok) return;
		isPaymentModalOpen = false;
		editingPayment = null;
		await invalidateAll();
	}

	async function deletePayment(payment: BillPayment) {
		if (!confirm('Delete this payment?')) return;
		const response = await fetch(`/api/payments/${payment.id}`, {
			method: 'DELETE'
		});
		if (response.ok) await invalidateAll();
	}

	async function saveBill(input: any) {
		editError = '';
		const response = await fetch(`/api/bills/${bill.id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(input)
		});
		const result = await response.json().catch(() => null);
		if (!response.ok) {
			editError = result?.error ?? 'Failed to update bill.';
			return;
		}
		isEditBillOpen = false;
		await invalidateAll();
	}
</script>

<svelte:head>
	<title>{bill.name} - BillTrack</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 py-8 dark:bg-gray-900">
	<div class="mx-auto max-w-6xl space-y-6 px-4 sm:px-6 lg:px-8">
		<a
			href="/"
			class="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
		>
			← Back to Dashboard
		</a>

		<section class="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800/80">
			<div class="flex flex-wrap items-start justify-between gap-5">
				<div>
					<div class="flex flex-wrap items-center gap-2">
						<h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">{bill.name}</h1>
						<span class="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-200">
							{bill.isRecurring ? 'Recurring' : 'One-time'}
						</span>
					</div>
					{#if bill.isRecurring && bill.recurrenceInterval && bill.recurrenceUnit}
						<p class="mt-2 text-sm text-gray-600 dark:text-gray-300">
							{getRecurrenceDescription(
								bill.recurrenceInterval,
								bill.recurrenceUnit,
								null
							)}
						</p>
					{/if}
					{#if bill.category}
						<p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
							{bill.category.name}
						</p>
					{/if}
				</div>
				<Button variant="secondary" size="sm" onclick={() => (isEditBillOpen = true)}>
					Edit Bill
				</Button>
			</div>

			{#if bill.notes}
				<p class="mt-5 whitespace-pre-wrap rounded-2xl bg-gray-50 p-4 text-sm text-gray-700 dark:bg-gray-900/40 dark:text-gray-300">
					{bill.notes}
				</p>
			{/if}
		</section>

		<CycleSelector
			{cycles}
			{selectedCycleId}
			onSelect={selectCycle}
			onAdd={openAddCycle}
			onResize={resizeCycle}
			isSaving={isSavingCycle}
			error={cycleError}
		/>

		<section class="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800/80">
			<div class="flex flex-wrap items-start justify-between gap-4">
				<div>
					<p class="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
						Cycle Viewer
					</p>
					<h2 class="mt-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
						{selectedCycle
							? `${formatStoredDate(selectedCycle.startDate)} – ${formatStoredDate(selectedCycle.endDate)}`
							: 'Select or add a cycle'}
					</h2>
				</div>
				<Button
					variant="primary"
					size="sm"
					onclick={openAddPayment}
					disabled={!selectedCycle}
				>
					Add Payment
				</Button>
			</div>

			{#if selectedCycle}
				<div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<div class="rounded-2xl bg-blue-50 p-4 dark:bg-blue-950/30">
						<p class="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">Paid</p>
						<p class="mt-2 text-2xl font-bold text-blue-950 dark:text-blue-100">
							{formatCurrency(selectedCycle.totalPaid)}
						</p>
					</div>
					<div class="rounded-2xl bg-gray-50 p-4 dark:bg-gray-900/40">
						<p class="text-xs font-semibold uppercase tracking-wide text-gray-500">Payments</p>
						<p class="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
							{selectedPayments.length}
						</p>
					</div>
					{#if !bill.isVariable}
						<div class="rounded-2xl bg-gray-50 p-4 dark:bg-gray-900/40">
							<p class="text-xs font-semibold uppercase tracking-wide text-gray-500">Expected</p>
							<p class="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
								{formatCurrency(selectedCycle.expectedAmount)}
							</p>
						</div>
						<div class="rounded-2xl bg-gray-50 p-4 dark:bg-gray-900/40">
							<p class="text-xs font-semibold uppercase tracking-wide text-gray-500">Remaining</p>
							<p class="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
								{formatCurrency(selectedRemaining ?? 0)}
							</p>
						</div>
					{/if}
				</div>

				{#if !bill.isVariable}
					<div class="mt-5">
						<div class="mb-2 flex justify-between text-sm text-gray-600 dark:text-gray-300">
							<span>Payment progress</span>
							<span>{selectedPercent.toFixed(0)}%</span>
						</div>
						<div class="h-3 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
							<div
								class="h-full rounded-full bg-blue-600 transition-all"
								style={`width: ${selectedPercent}%`}
							></div>
						</div>
					</div>
				{/if}

				<div class="mt-7 border-t border-gray-200 pt-6 dark:border-gray-700">
					<h3 class="font-semibold text-gray-900 dark:text-gray-100">Linked Payments</h3>
					{#if selectedPayments.length === 0}
						<p class="mt-3 text-sm text-gray-500 dark:text-gray-400">
							No payments have been linked to this cycle.
						</p>
					{:else}
						<div class="mt-3 space-y-3">
							{#each selectedPayments as payment}
								<div class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
									<div>
										<p class="font-semibold text-gray-900 dark:text-gray-100">
											{formatCurrency(payment.amount)}
										</p>
										<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
											{formatStoredDate(payment.paymentDate)}
											{payment.notes ? ` • ${payment.notes}` : ''}
										</p>
									</div>
									<div class="flex gap-2">
										<Button variant="ghost" size="sm" onclick={() => openEditPayment(payment)}>
											Edit
										</Button>
										<Button variant="ghost" size="sm" onclick={() => deletePayment(payment)}>
											Delete
										</Button>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{:else}
				<div class="mt-6 rounded-2xl border border-dashed border-gray-300 px-5 py-10 text-center text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">
					Add a cycle before recording payments.
				</div>
			{/if}
		</section>
	</div>
</div>

<Modal bind:isOpen={isAddingCycle} onClose={() => (isAddingCycle = false)} title="Add Cycle">
	<form class="space-y-4" onsubmit={addCycle}>
		<p class="text-sm text-gray-600 dark:text-gray-300">
			This is an editable placeholder. Saving it does not create any future cycles.
		</p>
		<div class="grid gap-4 sm:grid-cols-2">
			<div>
				<label for="newCycleStart" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Start Date</label>
				<input id="newCycleStart" type="date" bind:value={cycleStartDate} required class="mt-1 block w-full rounded-xl border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100" />
			</div>
			<div>
				<label for="newCycleEnd" class="block text-sm font-medium text-gray-700 dark:text-gray-300">End Date</label>
				<input id="newCycleEnd" type="date" bind:value={cycleEndDate} required class="mt-1 block w-full rounded-xl border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100" />
			</div>
		</div>
		{#if cycleError}
			<p class="text-sm text-red-600 dark:text-red-300">{cycleError}</p>
		{/if}
		<div class="flex justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
			<Button variant="secondary" onclick={() => (isAddingCycle = false)}>Cancel</Button>
			<Button type="submit" variant="primary" disabled={isSavingCycle}>
				{isSavingCycle ? 'Saving...' : 'Save Cycle'}
			</Button>
		</div>
	</form>
</Modal>

<Modal bind:isOpen={isEditBillOpen} onClose={() => (isEditBillOpen = false)} title="Edit Bill">
	{#if editError}
		<p class="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{editError}</p>
	{/if}
	<BillForm
		categories={data.categories}
		assetTags={data.assetTags}
		paymentMethods={data.paymentMethods}
		initialData={{
			name: bill.name,
			amount: bill.amount,
			paymentLink: bill.paymentLink ?? undefined,
			categoryId: bill.categoryId,
			assetTagId: bill.assetTagId,
			isRecurring: bill.isRecurring,
			recurrenceInterval: bill.recurrenceInterval,
			recurrenceUnit: bill.recurrenceUnit,
			isAutopay: bill.isAutopay,
			paymentMethodId: bill.paymentMethodId,
			isVariable: bill.isVariable,
			chargeToTenant: bill.chargeToTenant,
			notes: bill.notes ?? undefined
		}}
		onSubmit={saveBill}
		onCancel={() => (isEditBillOpen = false)}
		submitLabel="Save Changes"
	/>
</Modal>

<PaymentModal
	bind:isOpen={isPaymentModalOpen}
	bill={bill}
	{cycles}
	{selectedCycleId}
	existingPayment={editingPayment}
	onConfirm={savePayment}
	onCancel={() => {
		isPaymentModalOpen = false;
		editingPayment = null;
	}}
/>
