<script lang="ts">
	import type { BillWithCategory, BillWithLatestCycle } from '$lib/types/bill';
	import { goto } from '$app/navigation';
	import { formatCurrency } from '$lib/utils/format';
	import { formatStoredDate } from '$lib/utils/dates';
	import { getRecurrenceDescription } from '$lib/utils/recurrence';
	import { getAssetTagBannerStyle } from '$lib/utils/asset-tag-banner';
	import { Car, HelpCircle, Home } from 'lucide-svelte';

	interface Props {
		bill: BillWithCategory | BillWithLatestCycle;
		onEdit?: (id: number) => void;
		onDelete?: (id: number) => void;
	}

	let { bill, onEdit, onDelete }: Props = $props();

	const billWithLatest = $derived(
		'latestCycle' in bill ? (bill as BillWithLatestCycle) : null
	);
	const latestCycle = $derived(billWithLatest?.latestCycle ?? null);

	function openDetail(event: MouseEvent | KeyboardEvent) {
		const target = event.target as HTMLElement;
		if (target.closest('button') || target.closest('a')) return;
		goto(`/bills/${bill.id}`);
	}
</script>

<div
	class="group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
	role="button"
	tabindex="0"
	onclick={openDetail}
	onkeydown={(event) => event.key === 'Enter' && openDetail(event)}
>
	<div
		class="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white"
		style={getAssetTagBannerStyle(
			'assetTag' in bill ? bill.assetTag?.color : null,
			'assetTag' in bill ? bill.assetTag?.bannerPattern : null
		)}
	>
		{#if 'assetTag' in bill && bill.assetTag?.type === 'house'}
			<Home size={16} />
		{:else if 'assetTag' in bill && bill.assetTag?.type === 'vehicle'}
			<Car size={16} />
		{:else}
			<HelpCircle size={16} />
		{/if}
		<span class="truncate">
			{'assetTag' in bill && bill.assetTag ? bill.assetTag.name : 'No asset'}
		</span>
	</div>

	<div class="flex-1 p-5">
		<div class="flex items-start justify-between gap-3">
			<div>
				<h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">{bill.name}</h3>
				<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
					{bill.isRecurring && bill.recurrenceInterval && bill.recurrenceUnit
						? getRecurrenceDescription(
								bill.recurrenceInterval,
								bill.recurrenceUnit,
								null
							)
						: 'One-time bill'}
				</p>
			</div>
			<span class="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
				{bill.isVariable ? 'Variable' : formatCurrency(bill.amount)}
			</span>
		</div>

		{#if latestCycle}
			<div class="mt-5 rounded-2xl bg-gray-50 p-4 dark:bg-gray-900/40">
				<div class="flex items-center justify-between gap-3">
					<div>
						<p class="text-xs font-semibold uppercase tracking-wide text-gray-500">Latest Cycle</p>
						<p class="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">
							{formatStoredDate(latestCycle.startDate)} – {formatStoredDate(latestCycle.endDate)}
						</p>
					</div>
					<div class="text-right">
						<p class="text-xs text-gray-500">Paid</p>
						<p class="font-semibold text-blue-700 dark:text-blue-300">
							{formatCurrency(latestCycle.totalPaid)}
						</p>
					</div>
				</div>
				{#if !bill.isVariable}
					<div class="mt-3 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
						<div
							class="h-full rounded-full bg-blue-600"
							style={`width: ${latestCycle.percentPaid}%`}
						></div>
					</div>
				{/if}
			</div>
		{:else}
			<div class="mt-5 rounded-2xl border border-dashed border-gray-300 px-4 py-5 text-center text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">
				No cycles yet — open the bill to add one.
			</div>
		{/if}
	</div>

	<div class="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900/50">
		<a
			href={`/bills/${bill.id}`}
			class="text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
		>
			View cycles
		</a>
		<div class="flex gap-1">
			{#if onEdit}
				<button
					type="button"
					onclick={() => onEdit?.(bill.id)}
					class="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700"
				>
					Edit
				</button>
			{/if}
			{#if onDelete}
				<button
					type="button"
					onclick={() => {
						if (confirm('Delete this bill and all of its cycles and payments?')) {
							onDelete?.(bill.id);
						}
					}}
					class="rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
				>
					Delete
				</button>
			{/if}
		</div>
	</div>
</div>
