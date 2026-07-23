<script lang="ts">
	import type { Category } from '$lib/types/bill';
	import type { RecurrenceUnit } from '$lib/types/bill';
	import Button from '$lib/components/Button.svelte';
	import type { PaymentMethod } from '$lib/server/db/schema';
	import type { AssetTag } from '$lib/server/db/schema';

	interface Props {
		categories: Category[];
		assetTags?: AssetTag[];
		paymentMethods?: PaymentMethod[];
		initialData?: {
			name?: string;
			amount?: number;
			paymentLink?: string;
			categoryId?: number | null;
			assetTagId?: number | null;
			isRecurring?: boolean;
			recurrenceInterval?: number | null;
			recurrenceUnit?: RecurrenceUnit | null;
			isAutopay?: boolean;
			paymentMethodId?: number | null;
			isVariable?: boolean;
			chargeToTenant?: boolean;
			notes?: string;
		};
		onSubmit: (data: any) => Promise<void>;
		onCancel: () => void;
		submitLabel?: string;
	}

	let {
		categories,
		assetTags = [],
		paymentMethods = [],
		initialData,
		onSubmit,
		onCancel,
		submitLabel = 'Save Bill'
	}: Props = $props();

	let name = $state('');
	let amount = $state(0);
	let paymentLink = $state('');
	let categoryId = $state<number | null>(null);
	let assetTagId = $state<number | null>(null);
	let isRecurring = $state(false);
	let recurrenceInterval = $state(1);
	let recurrenceUnit = $state<RecurrenceUnit>('month');
	let isAutopay = $state(false);
	let paymentMethodId = $state<number | null>(null);
	let isVariable = $state(false);
	let chargeToTenant = $state(false);
	let notes = $state('');
	let isSubmitting = $state(false);

	$effect(() => {
		name = initialData?.name || '';
		amount = initialData?.amount || 0;
		paymentLink = initialData?.paymentLink || '';
		categoryId = initialData?.categoryId || null;
		assetTagId = initialData?.assetTagId || null;
		isRecurring = initialData?.isRecurring || false;
		recurrenceInterval = initialData?.recurrenceInterval || 1;
		recurrenceUnit = initialData?.recurrenceUnit || 'month';
		isAutopay = initialData?.isAutopay || false;
		paymentMethodId = initialData?.paymentMethodId ?? null;
		isVariable = initialData?.isVariable || false;
		chargeToTenant = initialData?.chargeToTenant || false;
		notes = initialData?.notes || '';
	});

	const selectedAssetIsRental = $derived.by(() => {
		if (assetTagId === null) return false;
		return assetTags.some((tag) => tag.id === assetTagId && tag.isRental);
	});

	$effect(() => {
		if (!isRecurring) {
			isVariable = false;
		}
	});

	$effect(() => {
		if (!selectedAssetIsRental) {
			chargeToTenant = false;
		}
	});

	async function handleSubmit(e: Event) {
		e.preventDefault();

		if (isAutopay && paymentMethodId === null) {
			alert('Select a payment method before enabling autopay.');
			return;
		}

		isSubmitting = true;

		try {

			await onSubmit({
				name,
				amount: isRecurring && isVariable ? 0 : parseFloat(amount.toString()),
				paymentLink: paymentLink || null,
				categoryId,
				assetTagId,
				chargeToTenant: selectedAssetIsRental ? chargeToTenant : false,
				isRecurring,
				recurrenceInterval: isRecurring ? recurrenceInterval : null,
				recurrenceUnit: isRecurring ? recurrenceUnit : null,
				isAutopay,
				paymentMethodId: isAutopay ? paymentMethodId : null,
				isVariable: isRecurring ? isVariable : false,
				notes: notes || null
			});
		} finally {
			isSubmitting = false;
		}
	}

	const sectionClass =
		'rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800/80';
	const fieldClass =
		'mt-1 block w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100';
</script>

<form onsubmit={handleSubmit} class="space-y-5">
	<section class={sectionClass}>
		<div class="mb-4">
			<p class="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">Basic Info</p>
			<h3 class="mt-2 text-xl font-semibold text-gray-900 dark:text-gray-100">What this bill is</h3>
			<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
				Name the bill and keep the reference details you want available later.
			</p>
		</div>

		<div class="grid gap-4 md:grid-cols-2">
			<div class="md:col-span-2">
				<label for="name" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
					Bill Name <span class="text-red-500 dark:text-red-400">*</span>
				</label>
				<input
					type="text"
					id="name"
					bind:value={name}
					required
					class={fieldClass}
					placeholder="e.g., Electric Bill"
				/>
			</div>

			<div class="md:col-span-2">
				<label for="paymentLink" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
					Payment Link
				</label>
				<input
					type="url"
					id="paymentLink"
					bind:value={paymentLink}
					class={fieldClass}
					placeholder="https://example.com/pay"
				/>
			</div>

			<div>
				<label for="category" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
				<select id="category" bind:value={categoryId} class={fieldClass}>
					<option value={null}>No Category</option>
					{#each categories as category}
						<option value={category.id}>{category.name}</option>
					{/each}
				</select>
			</div>

			<div>
				<label for="assetTag" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Asset Tag</label>
				<select id="assetTag" bind:value={assetTagId} class={fieldClass}>
					<option value={null}>No Asset Tag</option>
					{#each assetTags as tag}
						<option value={tag.id}>{tag.name}</option>
					{/each}
				</select>
			</div>

			{#if selectedAssetIsRental}
				<label class="md:col-span-2 flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
					<input
						type="checkbox"
						bind:checked={chargeToTenant}
						class="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600"
					/>
					<span>
						<span class="block text-sm font-medium text-gray-900 dark:text-gray-100">Charge tenant for this bill</span>
						<span class="mt-1 block text-sm text-gray-500 dark:text-gray-400">
							Include this bill on the Rentals page for payment notification tracking.
						</span>
					</span>
				</label>
			{/if}

			<div class="md:col-span-2">
				<label for="notes" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Notes</label>
				<textarea
					id="notes"
					bind:value={notes}
					rows="4"
					class={fieldClass}
					placeholder="Any extra billing or account details..."
				></textarea>
			</div>
		</div>
	</section>

	<section class={sectionClass}>
		<div class="mb-4">
			<p class="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">Billing</p>
			<h3 class="mt-2 text-xl font-semibold text-gray-900 dark:text-gray-100">How this bill works</h3>
			<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
				Set the bill type, amount, and the frequency label used to seed new cycle placeholders.
			</p>
		</div>

		<div class="space-y-4">
			<div class="rounded-2xl border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-700 dark:bg-gray-900/30">
				<p class="text-sm font-medium text-gray-900 dark:text-gray-100">Bill type</p>
				<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
					Choose whether this bill happens once or repeats on a schedule.
				</p>
				<div class="mt-4 grid gap-3 md:grid-cols-2">
					<button
						type="button"
						onclick={() => (isRecurring = false)}
						class={`rounded-2xl border px-4 py-4 text-left transition ${
							!isRecurring
								? 'border-slate-900 bg-white shadow-sm dark:border-slate-200 dark:bg-gray-800'
								: 'border-gray-200 bg-white/70 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800/40 dark:hover:border-gray-600'
						}`}
					>
						<p class="text-sm font-semibold text-gray-900 dark:text-gray-100">One-time bill</p>
						<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
						Track a single amount and add its cycles manually.
						</p>
					</button>
					<button
						type="button"
						onclick={() => (isRecurring = true)}
						class={`rounded-2xl border px-4 py-4 text-left transition ${
							isRecurring
								? 'border-blue-500 bg-blue-50 shadow-sm dark:border-blue-500 dark:bg-blue-950/30'
								: 'border-gray-200 bg-white/70 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800/40 dark:hover:border-gray-600'
						}`}
					>
						<p class="text-sm font-semibold text-gray-900 dark:text-gray-100">Recurring bill</p>
						<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
							Track a bill that repeats in billing cycles.
						</p>
					</button>
				</div>
			</div>

			{#if isRecurring}
				<div class="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800/40">
					<p class="text-sm font-medium text-gray-900 dark:text-gray-100">Recurrence</p>
					<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
						Used only to suggest the length of a new cycle placeholder.
					</p>
					<div class="mt-4 grid gap-2 sm:grid-cols-[auto_7rem_minmax(0,14rem)] sm:items-center">
						<span class="text-sm text-gray-600 dark:text-gray-400">Every</span>
						<input
							type="number"
							id="recurrenceInterval"
							min="1"
							step="1"
							bind:value={recurrenceInterval}
							class="rounded-2xl border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
						/>
						<select
							bind:value={recurrenceUnit}
							class="rounded-2xl border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
						>
							<option value="day">Day(s)</option>
							<option value="week">Week(s)</option>
							<option value="month">Month(s)</option>
							<option value="year">Year(s)</option>
						</select>
					</div>
				</div>

				<div class="rounded-2xl border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-700 dark:bg-gray-900/30">
					<p class="text-sm font-medium text-gray-900 dark:text-gray-100">Amount mode</p>
					<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
						Choose whether the amount is expected to stay fixed or change from cycle to cycle.
					</p>
					<div class="mt-4 grid gap-3 md:grid-cols-2">
						<button
							type="button"
							onclick={() => (isVariable = false)}
							class={`rounded-2xl border px-4 py-4 text-left transition ${
								!isVariable
									? 'border-slate-900 bg-white shadow-sm dark:border-slate-200 dark:bg-gray-800'
									: 'border-gray-200 bg-white/70 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800/40 dark:hover:border-gray-600'
							}`}
						>
							<p class="text-sm font-semibold text-gray-900 dark:text-gray-100">Fixed amount</p>
							<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
								Use a standard amount for each cycle.
							</p>
						</button>
						<button
							type="button"
							onclick={() => (isVariable = true)}
							class={`rounded-2xl border px-4 py-4 text-left transition ${
								isVariable
									? 'border-orange-400 bg-orange-50 shadow-sm dark:border-orange-500 dark:bg-orange-950/20'
									: 'border-gray-200 bg-white/70 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800/40 dark:hover:border-gray-600'
							}`}
						>
							<p class="text-sm font-semibold text-gray-900 dark:text-gray-100">Variable amount</p>
							<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
								Use payment history to capture the actual amount each cycle.
							</p>
						</button>
					</div>

					<div class="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700">
						<p class="text-sm font-medium text-gray-900 dark:text-gray-100">Amount</p>
						<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
							{#if isVariable}
								Variable bills do not require a fixed amount up front.
							{:else}
								Set the standard amount you expect for each cycle.
							{/if}
						</p>
						<div class="relative mt-4">
							<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
								<span class="text-gray-500 dark:text-gray-400">$</span>
							</div>
							<input
								type="number"
								id="amount"
								bind:value={amount}
								required={!isVariable}
								disabled={isVariable}
								min="0"
								step="0.01"
								class={`${fieldClass} pl-8 disabled:cursor-not-allowed disabled:bg-gray-100 dark:disabled:bg-gray-800`}
								placeholder="0.00"
							/>
						</div>
					</div>
				</div>

				{:else}
					<div class="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800/40">
						<p class="text-sm font-medium text-gray-900 dark:text-gray-100">One-time amount</p>
						<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
							Set the amount, then add the cycle dates from the bill detail page.
						</p>
						<div class="mt-4 max-w-md">
							<div>
							<label for="amount" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
								Amount <span class="text-red-500 dark:text-red-400">*</span>
							</label>
							<div class="relative mt-1">
								<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
									<span class="text-gray-500 dark:text-gray-400">$</span>
								</div>
								<input
									type="number"
									id="amount"
									bind:value={amount}
									required
									min="0"
									step="0.01"
									class={`${fieldClass} pl-8`}
									placeholder="0.00"
								/>
								</div>
							</div>
						</div>
					</div>
				{/if}
		</div>
	</section>

	<section class={sectionClass}>
		<div class="mb-4">
			<p class="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">Payment</p>
			<h3 class="mt-2 text-xl font-semibold text-gray-900 dark:text-gray-100">How you pay it</h3>
			<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
				Track whether this bill is automatic and which method should be associated with it.
			</p>
		</div>

		<div class="space-y-4">
			<div class="rounded-2xl border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-700 dark:bg-gray-900/30">
				<p class="text-sm font-medium text-gray-900 dark:text-gray-100">Payment mode</p>
				<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
					Choose whether this bill pays itself or you handle it manually.
				</p>
				<div class="mt-4 grid gap-3 md:grid-cols-2">
					<button
						type="button"
						onclick={() => (isAutopay = false)}
						class={`rounded-2xl border px-4 py-4 text-left transition ${
							!isAutopay
								? 'border-slate-900 bg-white shadow-sm dark:border-slate-200 dark:bg-gray-800'
								: 'border-gray-200 bg-white/70 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800/40 dark:hover:border-gray-600'
						}`}
					>
						<p class="text-sm font-semibold text-gray-900 dark:text-gray-100">Manual payment</p>
						<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
							Record payments when you make them yourself.
						</p>
					</button>
					<button
						type="button"
						onclick={() => (isAutopay = true)}
						class={`rounded-2xl border px-4 py-4 text-left transition ${
							isAutopay
								? 'border-green-500 bg-green-50 shadow-sm dark:border-green-500 dark:bg-green-950/20'
								: 'border-gray-200 bg-white/70 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800/40 dark:hover:border-gray-600'
						}`}
					>
						<p class="text-sm font-semibold text-gray-900 dark:text-gray-100">Autopay enabled</p>
						<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
							Attach a payment method if this bill is automatically paid.
						</p>
					</button>
				</div>
			</div>

			{#if isAutopay}
				<div class="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800/40">
					<label for="paymentMethodId" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
						Payment Method
					</label>
					<select
						id="paymentMethodId"
						bind:value={paymentMethodId}
						required
						class={fieldClass}
					>
						<option value={null}>Select a payment method</option>
						{#each paymentMethods as method}
							<option value={method.id}>
								{method.nickname} •••• {method.lastFour}
							</option>
						{/each}
					</select>
					{#if paymentMethods.length === 0}
						<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
							Add a payment method in Settings to use autopay.
						</p>
					{/if}
				</div>
			{/if}
		</div>
	</section>

	<div class="flex justify-end gap-3 pt-2">
		<Button variant="secondary" onclick={onCancel} disabled={isSubmitting}>
			Cancel
		</Button>
		<Button type="submit" disabled={isSubmitting}>
			{isSubmitting ? 'Saving...' : submitLabel}
		</Button>
	</div>
</form>
