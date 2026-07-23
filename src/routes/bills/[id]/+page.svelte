<script lang="ts">
	import type { PageData } from './$types';
	import type { BillPayment } from '$lib/server/db/schema';
	import { goto, invalidateAll, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import Button from '$lib/components/Button.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import BillForm from '$lib/components/BillForm.svelte';
	import PaymentModal from '$lib/components/PaymentModal.svelte';
	import CycleSelector from '$lib/components/CycleSelector.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import LineChart from '$lib/components/LineChart.svelte';
	import { createCyclePlaceholder, getLatestCycle } from '$lib/utils/manual-cycles';
	import { formatCurrency } from '$lib/utils/format';
	import { getAssetTagBannerStyle } from '$lib/utils/asset-tag-banner';
	import {
		decodeStoredCalendarDate,
		formatStoredDate,
		formatStoredDateForInput
	} from '$lib/utils/dates';
	import { getRecurrenceDescription } from '$lib/utils/recurrence';
	import {
		ArrowLeft,
		TrendingUp,
		Info,
		Home,
		Car,
		Zap,
		ShieldCheck,
		Receipt,
		ShoppingCart,
		Fuel,
		Utensils,
		Coffee,
		Popcorn,
		Dumbbell,
		Gamepad2,
		Smartphone,
		Shirt,
		Dog,
		Heart
	} from 'lucide-svelte';

	let { data }: { data: PageData } = $props();

	const bill = $derived(data.bill);
	const cycles = $derived(data.cycles);
	const payments = $derived(data.payments);
	function compareCycleStart(left: { id: number; startDate: Date }, right: { id: number; startDate: Date }) {
		return (
			decodeStoredCalendarDate(left.startDate).getTime() -
				decodeStoredCalendarDate(right.startDate).getTime() ||
			left.id - right.id
		);
	}
	const mostRecentCycle = $derived(getLatestCycle(cycles));
	const paymentsByCycle = $derived.by(() =>
		payments.reduce(
			(grouped, payment) => {
				(grouped[payment.cycleId] ??= []).push(payment);
				return grouped;
			},
			{} as Record<number, BillPayment[]>
		)
	);
	const paidHistoryCycles = $derived.by(() =>
		[...cycles]
			.filter((cycle) => cycle.totalPaid > 0)
			.sort(compareCycleStart)
			.slice(-10)
	);
	const historyChartPoints = $derived.by(() =>
		paidHistoryCycles.map((cycle, index) => ({
			x: index + 1,
			y: cycle.totalPaid,
			meta: {
				cycleNumber: index + 1,
				cyclePeriod: `${formatStoredDate(cycle.startDate)} - ${formatStoredDate(cycle.endDate)}`,
				paymentDates:
					paymentsByCycle[cycle.id]?.map((payment) =>
						formatStoredDate(payment.paymentDate)
					).join(', ') ?? 'No payment date',
				amountLabel: formatCurrency(cycle.totalPaid)
			}
		}))
	);
	const historyCycleOptions = $derived.by(() =>
		[...cycles]
			.sort((left, right) => compareCycleStart(right, left))
			.map((cycle) => ({
				id: cycle.id,
				label: `${formatStoredDate(cycle.startDate)} - ${formatStoredDate(cycle.endDate)}`
			}))
	);
	const historyStats = $derived.by(() => {
		if (paidHistoryCycles.length === 0) return null;
		const values = paidHistoryCycles.map((cycle) => cycle.totalPaid);
		const total = values.reduce((sum, value) => sum + value, 0);
		return {
			count: values.length,
			average: total / values.length,
			min: Math.min(...values),
			max: Math.max(...values),
			lastAmount: values.at(-1) ?? 0
		};
	});
	const AssetIcon = $derived.by(() => {
		if (bill.assetTag?.type === 'house') return Home;
		if (bill.assetTag?.type === 'vehicle') return Car;
		return null;
	});
	const CategoryIcon = $derived.by(() => {
		const iconMap = {
			utility: Zap,
			insurance: ShieldCheck,
			mortgage: Home,
			fee: Receipt,
			'shopping-cart': ShoppingCart,
			fuel: Fuel,
			utensils: Utensils,
			coffee: Coffee,
			popcorn: Popcorn,
			dumbbell: Dumbbell,
			gamepad: Gamepad2,
			smartphone: Smartphone,
			shirt: Shirt,
			home: Home,
			dog: Dog,
			heart: Heart
		};
		if (!bill.category?.icon) return null;
		return iconMap[bill.category.icon as keyof typeof iconMap] ?? null;
	});

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
	const selectedHistoryCycle = $derived(selectedCycle);
	const selectedHistoryPayments = $derived(
		selectedHistoryCycle ? paymentsByCycle[selectedHistoryCycle.id] ?? [] : []
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

	async function deleteBill() {
		if (!confirm('Are you sure you want to delete this bill?')) return;
		const response = await fetch(`/api/bills/${bill.id}`, { method: 'DELETE' });
		if (response.ok) await goto('/');
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

<div class="container mx-auto max-w-6xl px-4 py-8">
	<div class="mb-8">
		<button
			onclick={() => goto('/')}
			class="mb-4 flex cursor-pointer items-center gap-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
		>
			<ArrowLeft class="h-4 w-4" />
			Back to Bills
		</button>

		<div class="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
			<div class="border-b border-gray-200/80 bg-gradient-to-r from-white via-slate-50 to-blue-50/70 px-6 py-6 dark:border-gray-700 dark:from-gray-800 dark:via-gray-800 dark:to-blue-950/20">
				<div class="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
					<div class="flex-1">
						<h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">{bill.name}</h1>
						<div class="mt-3 flex flex-wrap items-center gap-2">
							<StatusBadge status={bill.isRecurring ? 'recurring' : 'one-time'} />
							<StatusBadge status={bill.isAutopay ? 'autopay' : 'manual'} />
							<StatusBadge status={bill.isVariable ? 'variable' : 'fixed'} />
						</div>
						<p class="mt-4 text-sm text-gray-600 dark:text-gray-400">
							{#if bill.isRecurring}
								Recurring {getRecurrenceDescription(
									bill.recurrenceInterval ?? 1,
									bill.recurrenceUnit ?? 'month',
									null
								)}
							{:else}
								One-time bill
							{/if}
						</p>
						{#if bill.notes}
							<div class="mt-4 inline-flex max-w-full items-start gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200">
								<Info size={15} class="mt-0.5 shrink-0" />
								<p class="whitespace-pre-wrap break-words italic">{bill.notes}</p>
							</div>
						{/if}
					</div>

					<div class="flex flex-wrap items-center gap-2 lg:justify-end">
						<button
							onclick={openAddPayment}
							disabled={!selectedCycle}
							class="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-2xl border border-gray-200 bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
							title="Add payment"
						>
							<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
							<span>Add Payment</span>
						</button>
						{#if bill.paymentLink}
							<a
								href={bill.paymentLink}
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 transition hover:border-blue-300 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-950"
								title="Pay bill"
							>
								<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
								</svg>
								<span>Open Payment Link</span>
							</a>
						{/if}
						<button
							onclick={() => (isEditBillOpen = true)}
							class="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-gray-600 dark:hover:bg-gray-950"
							title="Edit bill"
						>
							<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
							</svg>
							<span>Edit</span>
						</button>
						<button
							onclick={deleteBill}
							class="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition hover:border-red-300 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950"
							title="Delete bill"
						>
							<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
							</svg>
							<span>Delete</span>
						</button>
					</div>
				</div>
			</div>

			<div class="grid gap-3 px-6 py-5 sm:grid-cols-2 xl:grid-cols-4">
				<div class="rounded-2xl border border-gray-200 bg-gray-50/80 p-4 dark:border-gray-700 dark:bg-gray-900/40">
					<p class="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">Most Recent Cycle</p>
					<p class="mt-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
						{mostRecentCycle
							? `${formatStoredDate(mostRecentCycle.startDate, 'MMM d')} - ${formatStoredDate(mostRecentCycle.endDate, 'MMM d, yyyy')}`
							: 'None'}
					</p>
					<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Most recently saved billing period</p>
				</div>
				<div class="rounded-2xl border border-gray-200 bg-gray-50/80 p-4 dark:border-gray-700 dark:bg-gray-900/40">
					<p class="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">Autopay</p>
					<p class="mt-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
						{bill.isAutopay ? 'On' : 'Off'}
					</p>
					<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
						{#if bill.paymentMethod}
							{bill.paymentMethod.nickname} •••• {bill.paymentMethod.lastFour}
						{:else if bill.isAutopay}
							Payment method not linked
						{:else}
							Paid manually
						{/if}
					</p>
				</div>
				<div class="rounded-2xl border border-gray-200 bg-gray-50/80 p-4 dark:border-gray-700 dark:bg-gray-900/40">
					<p class="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">Category</p>
					{#if bill.category}
						<div class="mt-2 flex items-center gap-2">
							{#if CategoryIcon}
								<CategoryIcon size={16} style="color: {bill.category.color}" />
							{:else if bill.category.icon}
								<span class="text-sm" style="color: {bill.category.color}">{bill.category.icon}</span>
							{/if}
							<p class="text-lg font-semibold" style="color: {bill.category.color}">
								{bill.category.name}
							</p>
						</div>
					{:else}
						<p class="mt-2 text-lg font-semibold text-gray-900 dark:text-gray-100">Uncategorized</p>
					{/if}
				</div>
				<div class="rounded-2xl border border-gray-200 bg-gray-50/80 p-4 dark:border-gray-700 dark:bg-gray-900/40">
					<p class="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">Asset Tag</p>
					{#if bill.assetTag}
						<div
							class="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-sm font-medium text-white"
							style={getAssetTagBannerStyle(bill.assetTag.color, bill.assetTag.bannerPattern)}
						>
							{#if AssetIcon}
								<AssetIcon size={14} />
							{:else}
								<Info size={14} />
							{/if}
							<p class="truncate">{bill.assetTag.name}</p>
						</div>
					{:else}
						<p class="mt-2 text-lg font-semibold text-gray-900 dark:text-gray-100">None</p>
					{/if}
				</div>
			</div>
		</div>
	</div>

	<div class="mb-6">
		<CycleSelector
			{cycles}
			{selectedCycleId}
			onSelect={selectCycle}
			onAdd={openAddCycle}
			onResize={resizeCycle}
			isSaving={isSavingCycle}
			error={cycleError}
		/>
	</div>

	<div class="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
		<div class="mb-4 flex items-center gap-2">
			<TrendingUp class="h-5 w-5 text-purple-600 dark:text-purple-400" />
			<h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Payment History</h2>
		</div>
		<p class="mb-5 text-sm text-gray-600 dark:text-gray-400">
			Review recent cycles and drill into any payment you need to verify or edit.
		</p>

		{#if bill.isVariable && historyStats}
			<div class="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
				{#each [
					['Avg', historyStats.average],
					['Min', historyStats.min],
					['Max', historyStats.max],
					['Last', historyStats.lastAmount]
				] as stat}
					<div class="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
						<p class="text-xs text-gray-500 dark:text-gray-400">{stat[0]}</p>
						<p class="text-lg font-semibold text-gray-900 dark:text-gray-100">
							{formatCurrency(stat[1] as number)}
						</p>
					</div>
				{/each}
				<div class="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
					<p class="text-xs text-gray-500 dark:text-gray-400">Cycles</p>
					<p class="text-lg font-semibold text-gray-900 dark:text-gray-100">{historyStats.count}</p>
				</div>
			</div>
		{/if}

		{#if historyChartPoints.length > 0}
			<div class="mb-6">
				<p class="mb-3 text-sm text-gray-600 dark:text-gray-400">
					Recent {historyChartPoints.length} cycles
				</p>
				<div class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/30">
					<LineChart
						points={historyChartPoints}
						yLabel="Amount"
						showXAxis={false}
						showXAxisLabels={false}
						height={280}
					/>
				</div>
			</div>
		{/if}

		{#if historyCycleOptions.length > 0 && selectedHistoryCycle}
			<div class="space-y-4">
				<div class="rounded-xl border border-gray-200 bg-gray-50/80 p-4 dark:border-gray-700 dark:bg-gray-900/20">
					<label for="historyCycleSelect" class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
						View Cycle Details
					</label>
					<select
						id="historyCycleSelect"
						value={selectedCycleId ?? ''}
						onchange={(event) => selectCycle(Number(event.currentTarget.value))}
						class="block w-full rounded-lg border-gray-300 bg-white text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
					>
						{#each historyCycleOptions as option}
							<option value={option.id}>{option.label}</option>
						{/each}
					</select>
				</div>

				<div class="rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
					<div class="mb-3 flex items-center justify-between">
						<div>
							<h3 class="font-medium text-gray-900 dark:text-gray-100">
								{formatStoredDate(selectedHistoryCycle.startDate)} - {formatStoredDate(selectedHistoryCycle.endDate)}
							</h3>
							{#if !bill.isVariable}
								<p class="text-sm text-gray-600 dark:text-gray-400">
									Expected: {formatCurrency(selectedHistoryCycle.expectedAmount)}
								</p>
							{/if}
						</div>
						<p class="text-lg font-semibold text-gray-900 dark:text-gray-100">
							{formatCurrency(selectedHistoryCycle.totalPaid)}
						</p>
					</div>

					{#if selectedHistoryPayments.length > 0}
						<div class="mt-3 border-t border-gray-200 pt-3 dark:border-gray-700">
							<div class="space-y-1">
								{#each selectedHistoryPayments as payment}
									<div class="flex items-center justify-between gap-3 text-sm">
										<span class="min-w-0 text-gray-600 dark:text-gray-400">
											{formatStoredDate(payment.paymentDate)}
											{#if payment.notes}<span class="text-xs"> • {payment.notes}</span>{/if}
										</span>
										<div class="flex shrink-0 items-center gap-3">
											<span class="font-medium text-gray-900 dark:text-gray-100">
												{formatCurrency(payment.amount)}
											</span>
											<button
												type="button"
												onclick={() => openEditPayment(payment)}
												class="cursor-pointer text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
											>
												Edit
											</button>
											<button
												type="button"
												onclick={() => deletePayment(payment)}
												class="cursor-pointer text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
											>
												Delete
											</button>
										</div>
									</div>
								{/each}
							</div>
						</div>
					{:else}
						<div class="mt-3 border-t border-gray-200 pt-3 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
							No payments recorded in this cycle.
						</div>
					{/if}
				</div>
			</div>
		{:else}
			<div class="rounded-lg bg-gray-50 p-8 text-center dark:bg-gray-900/30">
				<p class="text-gray-600 dark:text-gray-400">No payment history yet</p>
			</div>
		{/if}
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
