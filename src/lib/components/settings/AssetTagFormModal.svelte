<script lang="ts">
	import Modal from '$lib/components/Modal.svelte';
	import Button from '$lib/components/Button.svelte';

	type AssetTagForm = {
		name: string;
		type: '' | 'house' | 'vehicle';
		color: string;
	};

	let {
		isOpen = $bindable(),
		mode,
		assetTagForm = $bindable(),
		onSubmit,
		onCancel
	}: {
		isOpen: boolean;
		mode: 'add' | 'edit';
		assetTagForm: AssetTagForm;
		onSubmit: () => void;
		onCancel: () => void;
	} = $props();

	const title = mode === 'add' ? 'Add Asset Tag' : 'Edit Asset Tag';
	const submitLabel = mode === 'add' ? 'Add Tag' : 'Update Tag';
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
				for="{mode}-asset-tag-name"
				class="block text-sm font-medium text-gray-700 dark:text-gray-300"
			>
				Tag Name
			</label>
			<input
				id="{mode}-asset-tag-name"
				type="text"
				bind:value={assetTagForm.name}
				required
				placeholder="e.g., House 1"
				class="mt-1 block w-full rounded-md border border-gray-300 bg-white text-gray-900 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-500"
			/>
		</div>

		<div>
			<label
				for="{mode}-asset-tag-type"
				class="block text-sm font-medium text-gray-700 dark:text-gray-300"
			>
				Type
			</label>
			<select
				id="{mode}-asset-tag-type"
				bind:value={assetTagForm.type}
				class="mt-1 block w-full rounded-md border border-gray-300 bg-white text-gray-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
			>
				<option value="">Other</option>
				<option value="house">House</option>
				<option value="vehicle">Vehicle</option>
			</select>
		</div>

		<div>
			<label
				for="{mode}-asset-tag-color"
				class="block text-sm font-medium text-gray-700 dark:text-gray-300"
			>
				Color
			</label>
			<div class="mt-1 flex gap-2">
				<input
					id="{mode}-asset-tag-color"
					type="color"
					bind:value={assetTagForm.color}
					class="h-10 w-20 rounded-md border border-gray-300 dark:border-gray-600"
				/>
				<input
					type="text"
					bind:value={assetTagForm.color}
					class="flex-1 rounded-md border border-gray-300 bg-white text-gray-900 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-500"
				/>
			</div>
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
