<script lang="ts">
	import Button from '$lib/components/Button.svelte';
	import type { PaymentMethod } from '$lib/server/db/schema';

	let {
		paymentMethods,
		onAdd,
		onEdit,
		onDelete
	}: {
		paymentMethods: PaymentMethod[];
		onAdd: () => void;
		onEdit: (id: number) => void;
		onDelete: (id: number, label: string) => void;
	} = $props();
</script>

<div class="mb-8 rounded-lg border border-gray-200 bg-white shadow-sm dark:bg-gray-800 dark:border-gray-700">
	<div class="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
		<div class="flex items-center justify-between">
			<div>
				<h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Payment Methods</h2>
				<p class="mt-1 text-sm text-gray-600 dark:text-gray-300">
					Manage the cards or accounts used for autopay.
				</p>
			</div>
			<Button variant="primary" size="md" onclick={onAdd}>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 4v16m8-8H4"
					/>
				</svg>
				Add Method
			</Button>
		</div>
	</div>

	<div class="p-6">
		{#if paymentMethods.length === 0}
			<div class="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center dark:border-gray-600">
				<svg
					class="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
					/>
				</svg>
				<h3 class="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">No payment methods</h3>
				<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Add a payment method to use for autopay.</p>
			</div>
		{:else}
			<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{#each paymentMethods as method (method.id)}
					<div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:bg-gray-700 dark:border-gray-600">
						<div class="flex items-start justify-between">
							<div class="flex items-center gap-3">
								<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-400">
									<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
										/>
									</svg>
								</div>
								<div>
									<h3 class="font-medium text-gray-900 dark:text-gray-100">{method.nickname}</h3>
									<p class="text-xs text-gray-500 dark:text-gray-400">•••• {method.lastFour}</p>
								</div>
							</div>
							<div class="flex gap-1">
								<button
									onclick={() => onEdit(method.id)}
									class="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-blue-600 dark:text-gray-500 dark:hover:bg-gray-600 dark:hover:text-blue-400"
									title="Edit payment method"
									aria-label="Edit payment method"
								>
									<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
										/>
									</svg>
								</button>
								<button
									onclick={() => onDelete(method.id, method.nickname)}
									class="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600 dark:text-gray-500 dark:hover:bg-gray-600 dark:hover:text-red-400"
									title="Delete payment method"
									aria-label="Delete payment method"
								>
									<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
