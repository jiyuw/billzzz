<script lang="ts">
	import Button from '$lib/components/Button.svelte';
	import { Home, Car, Tag } from 'lucide-svelte';
	import type { AssetTag } from '$lib/server/db/schema';

	let {
		assetTags,
		onAdd,
		onEdit,
		onDelete
	}: {
		assetTags: AssetTag[];
		onAdd: () => void;
		onEdit: (id: number) => void;
		onDelete: (id: number, name: string) => void;
	} = $props();
</script>

<div class="mb-8 rounded-lg border border-gray-200 bg-white shadow-sm dark:bg-gray-800 dark:border-gray-700">
	<div class="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
		<div class="flex items-center justify-between">
			<div>
				<h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Asset Tags</h2>
				<p class="mt-1 text-sm text-gray-600 dark:text-gray-300">
					Tag bills by asset or property (e.g., House 1, Car, Rental).
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
				Add Tag
			</Button>
		</div>
	</div>

	<div class="p-6">
		{#if assetTags.length === 0}
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
						d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
					/>
				</svg>
				<h3 class="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">No asset tags</h3>
				<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Add tags to group bills by asset.</p>
			</div>
		{:else}
			<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{#each assetTags as tag (tag.id)}
					{@const iconMap = { house: Home, vehicle: Car }}
					{@const DisplayIcon = tag.type ? iconMap[tag.type] : Tag}
					{@const colorMap = { house: '#10b981', vehicle: '#3b82f6', other: '#6b7280' }}
					{@const iconColor = tag.color || (tag.type ? colorMap[tag.type] : colorMap.other)}
					<div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:bg-gray-700 dark:border-gray-600">
						<div class="flex items-start justify-between">
							<div class="flex items-center gap-3">
								<div
									class="flex h-10 w-10 items-center justify-center rounded-lg"
									style="background-color: {iconColor}20; color: {iconColor}"
								>
									<DisplayIcon size={22} />
								</div>
								<div>
									<h3 class="font-medium text-gray-900 dark:text-gray-100">{tag.name}</h3>
									<p class="text-xs text-gray-500 dark:text-gray-400">
										{tag.type ? tag.type.charAt(0).toUpperCase() + tag.type.slice(1) : 'Other'}
									</p>
								</div>
							</div>
							<div class="flex gap-1">
								<button
									onclick={() => onEdit(tag.id)}
									class="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-blue-600 dark:text-gray-500 dark:hover:bg-gray-600 dark:hover:text-blue-400"
									title="Edit asset tag"
									aria-label="Edit asset tag"
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
									onclick={() => onDelete(tag.id, tag.name)}
									class="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600 dark:text-gray-500 dark:hover:bg-gray-600 dark:hover:text-red-400"
									title="Delete asset tag"
									aria-label="Delete asset tag"
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

			<div class="mt-4 text-sm text-gray-500 dark:text-gray-400">
				Total tags: {assetTags.length}
			</div>
		{/if}
	</div>
</div>
