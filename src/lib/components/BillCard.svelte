<script lang="ts">
	import type { BillWithCategory, BillWithCycle } from '$lib/types/bill';
import StatusIndicator from './StatusIndicator.svelte';
import CategoryBadge from './CategoryBadge.svelte';
import { format } from 'date-fns';
import { Home, Car, HelpCircle } from 'lucide-svelte';
	import { getRecurrenceDescription } from '$lib/utils/recurrence';
	import { goto } from '$app/navigation';
	import { formatCurrency } from '$lib/utils/format';

	interface Props {
		bill: BillWithCategory | BillWithCycle;
		onTogglePaid?: (id: number, isPaid: boolean) => void;
		onEdit?: (id: number) => void;
		onDelete?: (id: number) => void;
	}

	let { bill, onTogglePaid, onEdit, onDelete }: Props = $props();

	// Check if bill has cycle info
	const billWithCycle = $derived('currentCycle' in bill ? bill as BillWithCycle : null);
	const currentCycle = $derived(billWithCycle?.currentCycle);
	const focusCycle = $derived(billWithCycle?.focusCycle ?? billWithCycle?.currentCycle);
	const focusDueDate = $derived(focusCycle?.endDate ?? bill.dueDate);
	const usageStats = $derived(billWithCycle?.usageStats ?? null);
	const hasCurrentPayments = $derived((focusCycle?.totalPaid ?? 0) > 0);
	const isBillPaid = $derived.by(() => {
		const cycle = focusCycle ?? currentCycle;
		if (!cycle) return false;
		if (bill.isVariable) {
			return cycle.totalPaid > 0 || cycle.isPaid;
		}
		return cycle.isPaid || cycle.totalPaid >= cycle.expectedAmount;
	});
	const isCyclePaid = $derived.by(() => {
		if (!currentCycle) return false;
		if (currentCycle.expectedAmount > 0) {
			return currentCycle.isPaid || currentCycle.totalPaid >= currentCycle.expectedAmount;
		}
		return currentCycle.totalPaid > 0;
	});
	const currentPaid = $derived(focusCycle?.totalPaid ?? 0);
	const usageDotPosition = $derived.by(() => {
		if (!usageStats) return 0;
		if (usageStats.max === usageStats.min) return 50;
		return Math.min(
			Math.max(((currentPaid - usageStats.min) / (usageStats.max - usageStats.min)) * 100, 0),
			100
		);
	});

	function handleCardClick(e: MouseEvent | KeyboardEvent) {
		// Don't navigate if clicking on a button
		const target = e.target as HTMLElement;
		if (target.closest('button') || target.closest('a')) {
			return;
		}
		goto(`/bills/${bill.id}`);
	}

	async function handleTogglePaid() {
		if (onTogglePaid) {
			onTogglePaid(bill.id, !isBillPaid);
		}
	}

	async function handleEdit() {
		if (onEdit) {
			onEdit(bill.id);
		}
	}

	async function handleDelete() {
		if (onDelete && confirm('Are you sure you want to delete this bill?')) {
			onDelete(bill.id);
		}
	}
</script>

<div
	class="group relative flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-800 cursor-pointer"
	onclick={handleCardClick}
	role="button"
	tabindex="0"
	onkeydown={(e) => e.key === 'Enter' && handleCardClick(e)}
>
	<div class="p-4">
		<div class="mb-1 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
			{#if 'assetTag' in bill && bill.assetTag}
				{#if bill.assetTag.type === 'house'}
					<Home size={14} />
				{:else if bill.assetTag.type === 'vehicle'}
					<Car size={14} />
				{:else}
					<HelpCircle size={14} />
				{/if}
				{bill.assetTag.name}
			{:else}
				<HelpCircle size={14} />
				Unknown Asset
			{/if}
		</div>
		<div class="mb-2 flex flex-wrap items-center gap-2">
			<h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">{bill.name}</h3>
			{#if bill.isRecurring}
				<span
					class="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium leading-none text-blue-700 dark:bg-blue-950 dark:text-blue-400"
					title={bill.recurrenceUnit && bill.recurrenceInterval
						? getRecurrenceDescription(bill.recurrenceInterval, bill.recurrenceUnit as any, bill.recurrenceDay)
						: ''}
				>
					<svg class="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
						<path
							fill-rule="evenodd"
							d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
							clip-rule="evenodd"
						/>
					</svg>
					Recurring
				</span>
			{/if}
			{#if bill.isAutopay}
				<span
					class="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium leading-none text-green-700 dark:bg-green-950 dark:text-green-400"
					title="This bill is set to autopay"
				>
					<svg class="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
						<path
							d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"
						/>
						<path
							fill-rule="evenodd"
							d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z"
							clip-rule="evenodd"
						/>
					</svg>
					Autopay
				</span>
			{/if}
		</div>

		<div class="mb-3 flex flex-wrap items-center gap-2">
			<StatusIndicator
				dueDate={focusDueDate}
				isPaid={isBillPaid}
			/>
			{#if 'category' in bill && bill.category}
				<CategoryBadge category={bill.category} />
			{/if}
		</div>

		<div class="grid grid-cols-2 gap-3 text-sm">
			<div>
				{#if bill.isVariable}
					<span class="text-gray-500 dark:text-gray-400">Amount:</span>
					<span class="ml-2 font-semibold text-gray-900 dark:text-gray-100">Variable</span>
				{:else}
					<span class="text-gray-500 dark:text-gray-400">Amount:</span>
					<span class="ml-2 font-semibold text-gray-900 dark:text-gray-100">
						{formatCurrency(bill.amount)}
					</span>
				{/if}
			</div>
			<div>
				<span class="text-gray-500 dark:text-gray-400">Due:</span>
				<span class="ml-2 font-medium text-gray-900 dark:text-gray-100">
					{format(focusDueDate, 'MMM d, yyyy')}
				</span>
			</div>
		</div>

		{#if bill.notes}
			<p class="mt-2 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{bill.notes}</p>
		{/if}

		<!-- Cycle Progress (if available) -->
		{#if bill.isVariable}
			<div class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
				<div class="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
					<span>Current Cycle</span>
					<span>{hasCurrentPayments ? `${formatCurrency(currentPaid)} paid` : 'Unpaid'}</span>
				</div>
				<div class="relative w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
					{#if hasCurrentPayments}
						<div
							class="h-2 rounded-full transition-all bg-green-200"
							style="width: 100%"
						></div>
						{#if usageStats}
							<div
								class="absolute top-1/2 h-3 w-3 -translate-y-1/2 -translate-x-1/2 rounded-full bg-green-500 ring-2 ring-white shadow-sm"
								style="left: {usageDotPosition}%"
								aria-hidden="true"
							></div>
						{/if}
					{/if}
				</div>
				<div class="flex justify-between text-xs text-gray-600 dark:text-gray-400 mt-1">
					<span>{usageStats ? `Min: ${formatCurrency(usageStats.min)}` : 'Min: —'}</span>
					<span>{usageStats ? `Max: ${formatCurrency(usageStats.max)}` : 'Max: —'}</span>
				</div>
			</div>
		{:else if focusCycle}
			<div class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
				<div class="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
					<span>Current Cycle</span>
					<span>{focusCycle.percentPaid.toFixed(0)}% paid</span>
				</div>
				<div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
					<div
						class="h-2 rounded-full transition-all {focusCycle.isPaid || focusCycle.totalPaid >= focusCycle.expectedAmount
							? 'bg-green-500'
							: focusCycle.totalPaid > 0
							? 'bg-yellow-500'
							: 'bg-gray-300 dark:bg-gray-600'}"
						style="width: {focusCycle.percentPaid}%"
					></div>
				</div>
				<div class="flex justify-between text-xs text-gray-600 dark:text-gray-400 mt-1">
					<span>${focusCycle.totalPaid.toFixed(2)} paid</span>
					<span>${focusCycle.remaining.toFixed(2)} remaining</span>
				</div>
			</div>
		{/if}
	</div>

	<!-- Action Buttons -->
	<div class="flex items-center justify-end gap-1 border-t border-gray-100 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-900">
		<button
			onclick={handleTogglePaid}
			class="rounded-md p-2 min-h-9 min-w-9 transition-all text-gray-500 hover:bg-gray-100 hover:text-gray-700 hover:scale-105 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-300 cursor-pointer"
			title={isCyclePaid ? 'Paid' : 'Mark as paid'}
		>
			{#if isCyclePaid}
				<svg
					class="h-6 w-6"
					viewBox="0 0 20 20"
					xmlns="http://www.w3.org/2000/svg"
					aria-hidden="true"
				>
					<circle cx="10" cy="10" r="8" fill="#16a34a" />
					<path
						d="M6.5 10.5l2 2 5-5"
						fill="none"
						stroke="#ffffff"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			{:else}
				<svg
					class="h-6 w-6"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
			{/if}
		</button>

		{#if bill.paymentLink}
			<a
				href={bill.paymentLink}
				target="_blank"
				rel="noopener noreferrer"
				class="rounded-md p-3 min-h-11 min-w-11 flex items-center justify-center text-gray-500 transition-colors hover:bg-blue-50 hover:text-blue-600 dark:text-gray-400 dark:hover:bg-blue-950 dark:hover:text-blue-400"
				title="Pay bill"
			>
				<svg
					class="h-5 w-5"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
					/>
				</svg>
			</a>
		{/if}

		<button
			onclick={handleEdit}
			class="rounded-md p-2 min-h-9 min-w-9 text-gray-500 transition-all hover:bg-blue-50 hover:text-blue-600 hover:scale-105 dark:text-gray-400 dark:hover:bg-blue-950 dark:hover:text-blue-400 cursor-pointer"
			title="Edit bill"
		>
			<svg
				class="h-6 w-6"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
				xmlns="http://www.w3.org/2000/svg"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
				/>
			</svg>
		</button>

		<button
			onclick={handleDelete}
			class="rounded-md p-2 min-h-9 min-w-9 text-gray-500 transition-all hover:bg-red-50 hover:text-red-600 hover:scale-105 dark:text-gray-400 dark:hover:bg-red-950 dark:hover:text-red-400 cursor-pointer"
			title="Delete bill"
		>
			<svg
				class="h-6 w-6"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
				xmlns="http://www.w3.org/2000/svg"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
				/>
			</svg>
		</button>
	</div>
</div>
