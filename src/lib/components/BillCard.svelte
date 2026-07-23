<script lang="ts">
	import type { BillWithCategory, BillWithLatestCycle } from '$lib/types/bill';
	import StatusBadge from './StatusBadge.svelte';
	import {
		Home,
		Car,
		HelpCircle,
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
	import { getRecurrenceDescription } from '$lib/utils/recurrence';
	import { goto } from '$app/navigation';
	import { formatCurrency } from '$lib/utils/format';
	import { formatStoredDate } from '$lib/utils/dates';
	import { getAssetTagBannerStyle } from '$lib/utils/asset-tag-banner';

	interface Props {
		bill: BillWithCategory | BillWithLatestCycle;
		onAddPayment?: (id: number) => void;
		onEdit?: (id: number) => void;
		onDelete?: (id: number) => void;
	}

	let { bill, onAddPayment, onEdit, onDelete }: Props = $props();

	const billWithLatest = $derived(
		'latestCycle' in bill ? (bill as BillWithLatestCycle) : null
	);
	const latestCycle = $derived(billWithLatest?.latestCycle ?? null);
	const usageStats = $derived(billWithLatest?.usageStats ?? null);
	const hasRecentPayments = $derived((latestCycle?.totalPaid ?? 0) > 0);
	const recentPaid = $derived(latestCycle?.totalPaid ?? 0);
	const usageDotPosition = $derived.by(() => {
		if (!usageStats) return 0;
		if (usageStats.max === usageStats.min) return 50;
		return Math.min(
			Math.max(
				((recentPaid - usageStats.min) / (usageStats.max - usageStats.min)) * 100,
				0
			),
			100
		);
	});
	const progressClass = $derived.by(() => {
		if (!latestCycle || latestCycle.totalPaid <= 0) return 'bg-gray-400';
		if (latestCycle.totalPaid >= latestCycle.expectedAmount) return 'bg-green-500';
		return 'bg-yellow-500';
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

		if (!('category' in bill) || !bill.category?.icon) return null;
		return iconMap[bill.category.icon as keyof typeof iconMap] ?? null;
	});

	function handleCardClick(event: MouseEvent | KeyboardEvent) {
		const target = event.target as HTMLElement;
		if (target.closest('button') || target.closest('a')) return;
		goto(`/bills/${bill.id}`);
	}

	function handleDelete() {
		if (onDelete && confirm('Are you sure you want to delete this bill?')) {
			onDelete(bill.id);
		}
	}
</script>

<div
	class="group relative flex cursor-pointer flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
	onclick={handleCardClick}
	role="button"
	tabindex="0"
	onkeydown={(event) => event.key === 'Enter' && handleCardClick(event)}
>
	<div
		class="flex items-center gap-1.5 px-4 py-1.5 text-sm leading-none font-semibold text-white"
		style={getAssetTagBannerStyle(
			'assetTag' in bill ? bill.assetTag?.color : null,
			'assetTag' in bill ? bill.assetTag?.bannerPattern : null
		)}
	>
		{#if 'assetTag' in bill && bill.assetTag}
			{#if bill.assetTag.type === 'house'}
				<Home size={15} />
			{:else if bill.assetTag.type === 'vehicle'}
				<Car size={15} />
			{:else}
				<HelpCircle size={15} />
			{/if}
			<span class="truncate">{bill.assetTag.name}</span>
		{:else}
			<HelpCircle size={15} />
			<span>Unknown Asset</span>
		{/if}
	</div>

	<div class="p-4">
		<div class="mb-2 flex min-h-[32px] flex-wrap items-center gap-x-2 gap-y-2 pl-1">
			{#if 'category' in bill && bill.category}
				<div
					class="flex shrink-0 items-center"
					title={bill.category.name}
					aria-label={bill.category.name}
				>
					{#if CategoryIcon}
						<CategoryIcon size={18} style="color: {bill.category.color}" />
					{:else if bill.category.icon}
						<span class="text-sm leading-none" style="color: {bill.category.color}">
							{bill.category.icon}
						</span>
					{:else}
						<span class="text-sm leading-none" style="color: {bill.category.color}">•</span>
					{/if}
				</div>
			{:else}
				<div
					class="flex shrink-0 items-center text-gray-500 dark:text-gray-400"
					title="Uncategorized"
					aria-label="Uncategorized"
				>
					<HelpCircle size={17} />
				</div>
			{/if}
			<div class="flex min-w-0 flex-wrap items-center gap-2.5">
				<h3 class="max-w-full truncate text-lg font-semibold text-gray-900 dark:text-gray-100">
					{bill.name}
				</h3>
				{#if bill.isRecurring}
					<StatusBadge
						status="recurring"
						iconOnly={true}
						title={bill.recurrenceUnit && bill.recurrenceInterval
							? getRecurrenceDescription(
									bill.recurrenceInterval,
									bill.recurrenceUnit,
									null
								)
							: 'Recurring'}
					/>
				{/if}
				{#if bill.isAutopay}
					<StatusBadge status="autopay" iconOnly={true} title="This bill is set to autopay" />
				{/if}
			</div>
		</div>

		<div class="grid grid-cols-2 gap-3 text-sm">
			<div>
				<span class="text-gray-500 dark:text-gray-400">Amount:</span>
				<span class="ml-2 font-semibold text-gray-900 dark:text-gray-100">
					{bill.isVariable ? 'Variable' : formatCurrency(bill.amount)}
				</span>
			</div>
			<div>
				<span class="text-gray-500 dark:text-gray-400">Cycle:</span>
				<span class="ml-2 font-medium text-gray-900 dark:text-gray-100">
					{latestCycle
						? `${formatStoredDate(latestCycle.startDate, 'MMM d')} – ${formatStoredDate(latestCycle.endDate, 'MMM d')}`
						: '—'}
				</span>
			</div>
		</div>

		{#if latestCycle}
			{#if bill.isVariable}
				<div class="mt-3 border-t border-gray-200 pt-3 dark:border-gray-700">
					<div class="mb-1 flex justify-between text-xs text-gray-600 dark:text-gray-400">
						<span>Recent Cycle</span>
						<span>{hasRecentPayments ? `${formatCurrency(recentPaid)} paid` : 'Unpaid'}</span>
					</div>
					<div class="relative h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
						{#if hasRecentPayments}
							<div class="h-2 rounded-full bg-green-200 transition-all" style="width: 100%"></div>
							{#if usageStats}
								<div
									class="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-green-500 shadow-sm ring-2 ring-white"
									style="left: {usageDotPosition}%"
									aria-hidden="true"
								></div>
							{/if}
						{/if}
					</div>
					<div class="mt-1 flex justify-between text-xs text-gray-600 dark:text-gray-400">
						<span>{usageStats ? `Min: ${formatCurrency(usageStats.min)}` : 'Min: —'}</span>
						<span>{usageStats ? `Max: ${formatCurrency(usageStats.max)}` : 'Max: —'}</span>
					</div>
				</div>
			{:else}
				<div class="mt-3 border-t border-gray-200 pt-3 dark:border-gray-700">
					<div class="mb-1 flex justify-between text-xs text-gray-600 dark:text-gray-400">
						<span>Recent Cycle</span>
						<span>{latestCycle.percentPaid.toFixed(0)}% paid</span>
					</div>
					<div class="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
						<div
							class="h-2 rounded-full transition-all {progressClass}"
							style="width: {latestCycle.percentPaid}%"
						></div>
					</div>
					<div class="mt-1 flex justify-between text-xs text-gray-600 dark:text-gray-400">
						<span>{formatCurrency(latestCycle.totalPaid)} paid</span>
						<span>{formatCurrency(latestCycle.remaining)} remaining</span>
					</div>
				</div>
			{/if}
		{:else}
			<div class="mt-3 border-t border-gray-200 pt-3 text-xs text-gray-600 dark:border-gray-700 dark:text-gray-400">
				<span>Recent Cycle</span>
				<span class="float-right">No cycle added</span>
			</div>
		{/if}
	</div>

	<div class="flex items-center justify-end gap-1 border-t border-gray-100 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-900">
		<button
			type="button"
			onclick={() => onAddPayment?.(bill.id)}
			disabled={!latestCycle || !onAddPayment}
			class="min-h-9 min-w-9 cursor-pointer rounded-md p-2 text-gray-500 transition-all hover:scale-105 hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-300"
			title="Add payment"
		>
			<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
		</button>

		{#if bill.paymentLink}
			<a
				href={bill.paymentLink}
				target="_blank"
				rel="noopener noreferrer"
				class="flex min-h-9 min-w-9 items-center justify-center rounded-md p-2 text-gray-500 transition-all hover:scale-105 hover:bg-blue-50 hover:text-blue-600 dark:text-gray-400 dark:hover:bg-blue-950 dark:hover:text-blue-400"
				title="Pay bill"
			>
				<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
			type="button"
			onclick={() => onEdit?.(bill.id)}
			class="min-h-9 min-w-9 cursor-pointer rounded-md p-2 text-gray-500 transition-all hover:scale-105 hover:bg-blue-50 hover:text-blue-600 dark:text-gray-400 dark:hover:bg-blue-950 dark:hover:text-blue-400"
			title="Edit bill"
		>
			<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
				/>
			</svg>
		</button>

		<button
			type="button"
			onclick={handleDelete}
			class="min-h-9 min-w-9 cursor-pointer rounded-md p-2 text-gray-500 transition-all hover:scale-105 hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-950 dark:hover:text-red-400"
			title="Delete bill"
		>
			<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
