<script lang="ts">
	import type { PageData } from './$types';
	import type { BillWithLatestCycle } from '$lib/types/bill';
	import { invalidateAll, goto } from '$app/navigation';
	import BillCard from '$lib/components/BillCard.svelte';
	import BillForm from '$lib/components/BillForm.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import Button from '$lib/components/Button.svelte';
	import PaymentModal from '$lib/components/PaymentModal.svelte';

	let { data }: { data: PageData } = $props();

	let searchQuery = $state('');
	let filterStatus = $state<'all' | 'paid' | 'unpaid'>('all');
	let filterCategory = $state<number | null>(null);
	let filterAssetTag = $state<number | null>(null);
	let sortField = $state<'assetTag' | 'name'>('assetTag');
	let editingBillId = $state<number | null>(null);
	let editError = $state('');
	let paymentBillId = $state<number | null>(null);

	const editingBill = $derived(
		editingBillId !== null
			? data.bills.find((bill: BillWithLatestCycle) => bill.id === editingBillId) ?? null
			: null
	);
	const paymentBill = $derived(
		paymentBillId !== null
			? data.bills.find((bill: BillWithLatestCycle) => bill.id === paymentBillId) ?? null
			: null
	);

	function isLatestCyclePaid(bill: BillWithLatestCycle) {
		const cycle = bill.latestCycle;
		if (!cycle) return false;
		if (bill.isVariable) return cycle.totalPaid > 0;
		return cycle.totalPaid >= cycle.expectedAmount;
	}

	const visibleBills = $derived.by(() => {
		const normalizedSearch = searchQuery.trim().toLowerCase();
		return [...data.bills]
			.filter((bill: BillWithLatestCycle) => {
				if (
					normalizedSearch &&
					!bill.name.toLowerCase().includes(normalizedSearch) &&
					!bill.notes?.toLowerCase().includes(normalizedSearch)
				) {
					return false;
				}
				if (filterCategory !== null && bill.categoryId !== filterCategory) return false;
				if (filterAssetTag !== null && bill.assetTagId !== filterAssetTag) return false;
				if (filterStatus === 'paid' && !isLatestCyclePaid(bill)) return false;
				if (filterStatus === 'unpaid' && isLatestCyclePaid(bill)) return false;
				return true;
			})
			.sort((left: BillWithLatestCycle, right: BillWithLatestCycle) => {
				if (sortField === 'name') return left.name.localeCompare(right.name);
				const leftAsset = left.assetTag?.name ?? '';
				const rightAsset = right.assetTag?.name ?? '';
				return leftAsset.localeCompare(rightAsset) || left.name.localeCompare(right.name);
			});
	});

	const hasFilters = $derived(
		searchQuery.trim().length > 0 ||
			filterStatus !== 'all' ||
			filterCategory !== null ||
			filterAssetTag !== null
	);

	function clearFilters() {
		searchQuery = '';
		filterStatus = 'all';
		filterCategory = null;
		filterAssetTag = null;
	}

	async function saveBill(input: any) {
		if (!editingBill) return;
		editError = '';
		const response = await fetch(`/api/bills/${editingBill.id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(input)
		});
		const result = await response.json().catch(() => null);
		if (!response.ok) {
			editError = result?.error ?? 'Failed to update bill.';
			return;
		}
		editingBillId = null;
		await invalidateAll();
	}

	async function deleteBill(id: number) {
		const response = await fetch(`/api/bills/${id}`, { method: 'DELETE' });
		if (response.ok) await invalidateAll();
	}

	async function savePayment(input: {
		amount: number;
		paymentDate: string;
		cycleId: number | null;
		notes?: string;
	}) {
		if (!paymentBill || input.cycleId === null) return;
		const response = await fetch(`/api/bills/${paymentBill.id}/payments`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(input)
		});
		if (!response.ok) return;
		paymentBillId = null;
		await invalidateAll();
	}
</script>

<svelte:head>
	<title>BillTrack</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 py-8 dark:bg-gray-900">
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<header class="flex flex-wrap items-center justify-between gap-5">
			<div>
				<p class="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">BillTrack</p>
				<h1 class="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">Bills</h1>
				<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
					Manage saved cycles and their linked payments.
				</p>
			</div>
			<Button variant="primary" onclick={() => goto('/bills/new')}>Add Bill</Button>
		</header>

		<section class="mt-7 grid gap-4 sm:grid-cols-3">
			<div class="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
				<p class="text-sm text-gray-500 dark:text-gray-400">Total bills</p>
				<p class="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">{data.stats.totalBills}</p>
			</div>
			<div class="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
				<p class="text-sm text-gray-500 dark:text-gray-400">Latest cycle unpaid</p>
				<p class="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">{data.stats.unpaidBills}</p>
			</div>
			<div class="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
				<p class="text-sm text-gray-500 dark:text-gray-400">Showing</p>
				<p class="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">{visibleBills.length}</p>
			</div>
		</section>

		<section class="mt-6 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
			<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
				<div class="lg:col-span-2">
					<label for="billSearch" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Search</label>
					<input
						id="billSearch"
						type="search"
						bind:value={searchQuery}
						placeholder="Search bills or notes"
						class="mt-1 block w-full rounded-xl border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
					/>
				</div>
				<div>
					<label for="statusFilter" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Latest cycle</label>
					<select id="statusFilter" bind:value={filterStatus} class="mt-1 block w-full rounded-xl border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100">
						<option value="all">All</option>
						<option value="paid">Paid</option>
						<option value="unpaid">Unpaid</option>
					</select>
				</div>
				<div>
					<label for="categoryFilter" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
					<select id="categoryFilter" bind:value={filterCategory} class="mt-1 block w-full rounded-xl border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100">
						<option value={null}>All</option>
						{#each data.categories as category}
							<option value={category.id}>{category.name}</option>
						{/each}
					</select>
				</div>
				<div>
					<label for="assetFilter" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Asset</label>
					<select id="assetFilter" bind:value={filterAssetTag} class="mt-1 block w-full rounded-xl border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100">
						<option value={null}>All</option>
						{#each data.assetTags as asset}
							<option value={asset.id}>{asset.name}</option>
						{/each}
					</select>
				</div>
			</div>
			<div class="mt-4 flex items-center justify-between gap-3">
				<select bind:value={sortField} aria-label="Sort bills" class="rounded-xl border-gray-300 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100">
					<option value="assetTag">Sort by asset</option>
					<option value="name">Sort by name</option>
				</select>
				{#if hasFilters}
					<Button variant="ghost" size="sm" onclick={clearFilters}>Clear filters</Button>
				{/if}
			</div>
		</section>

		{#if visibleBills.length === 0}
			<div class="mt-6 rounded-3xl border border-dashed border-gray-300 px-6 py-16 text-center dark:border-gray-600">
				<p class="font-semibold text-gray-900 dark:text-gray-100">No bills match this view</p>
				<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Clear filters or add a new bill.</p>
			</div>
		{:else}
			<div class="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
				{#each visibleBills as bill}
					<BillCard
						{bill}
						onAddPayment={(id) => (paymentBillId = id)}
						onEdit={(id) => (editingBillId = id)}
						onDelete={deleteBill}
					/>
				{/each}
			</div>
		{/if}
	</div>
</div>

{#if editingBill}
	<Modal
		isOpen={editingBillId !== null}
		onClose={() => (editingBillId = null)}
		title="Edit Bill"
	>
		{#if editError}
			<p class="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{editError}</p>
		{/if}
		<BillForm
			categories={data.categories}
			assetTags={data.assetTags}
			paymentMethods={data.paymentMethods}
			initialData={{
				name: editingBill.name,
				amount: editingBill.amount,
				paymentLink: editingBill.paymentLink ?? undefined,
				categoryId: editingBill.categoryId,
				assetTagId: editingBill.assetTagId,
				isRecurring: editingBill.isRecurring,
				recurrenceInterval: editingBill.recurrenceInterval,
				recurrenceUnit: editingBill.recurrenceUnit,
				isAutopay: editingBill.isAutopay,
				paymentMethodId: editingBill.paymentMethodId,
				isVariable: editingBill.isVariable,
				chargeToTenant: editingBill.chargeToTenant,
				notes: editingBill.notes ?? undefined
			}}
			onSubmit={saveBill}
			onCancel={() => (editingBillId = null)}
			submitLabel="Save Changes"
		/>
	</Modal>
{/if}

<PaymentModal
	isOpen={paymentBillId !== null}
	bill={paymentBill}
	selectedCycleId={paymentBill?.latestCycle?.id ?? null}
	onConfirm={savePayment}
	onCancel={() => (paymentBillId = null)}
/>
