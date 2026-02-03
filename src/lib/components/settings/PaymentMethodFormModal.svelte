<script lang="ts">
	import Modal from '$lib/components/Modal.svelte';
	import Button from '$lib/components/Button.svelte';

	type PaymentMethodForm = {
		nickname: string;
		lastFour: string;
	};

	let {
		isOpen = $bindable(),
		mode,
		paymentMethodForm = $bindable(),
		onSubmit,
		onCancel
	}: {
		isOpen: boolean;
		mode: 'add' | 'edit';
		paymentMethodForm: PaymentMethodForm;
		onSubmit: () => void;
		onCancel: () => void;
	} = $props();

	const title = mode === 'add' ? 'Add Payment Method' : 'Edit Payment Method';
	const submitLabel = mode === 'add' ? 'Add Method' : 'Update Method';
</script>

<Modal bind:isOpen onClose={onCancel} {title}>
	<form
		onsubmit={(e) => {
			e.preventDefault();
			onSubmit();
		}}
		class="space-y-4"
	>
		<div>
			<label
				for="{mode}-payment-nickname"
				class="block text-sm font-medium text-gray-700 dark:text-gray-300"
			>
				Nickname
			</label>
			<input
				id="{mode}-payment-nickname"
				type="text"
				bind:value={paymentMethodForm.nickname}
				required
				placeholder="e.g., Chase Sapphire"
				class="mt-1 block w-full rounded-md border border-gray-300 bg-white text-gray-900 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-500"
			/>
		</div>

		<div>
			<label
				for="{mode}-payment-last4"
				class="block text-sm font-medium text-gray-700 dark:text-gray-300"
			>
				Last 4 Digits
			</label>
			<input
				id="{mode}-payment-last4"
				type="text"
				inputmode="numeric"
				maxlength="4"
				pattern="\\d{4}"
				bind:value={paymentMethodForm.lastFour}
				required
				placeholder="1234"
				class="mt-1 block w-full rounded-md border border-gray-300 bg-white text-gray-900 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-500"
			/>
			<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">Enter the last 4 digits only.</p>
		</div>

		<div class="flex gap-3 pt-4">
			<Button type="submit" variant="primary" size="md" fullWidth={true}>
				{submitLabel}
			</Button>
			<Button variant="secondary" size="md" onclick={onCancel} fullWidth={true}>
				Cancel
			</Button>
		</div>
	</form>
</Modal>
