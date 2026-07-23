<script lang="ts">
	import {
		CreditCard,
		CircleDollarSign,
		CircleDot,
		RefreshCcw
	} from 'lucide-svelte';

	type MetadataStatus =
		| 'recurring'
		| 'one-time'
		| 'autopay'
		| 'manual'
		| 'variable'
		| 'fixed';

	interface Props {
		status: MetadataStatus;
		label?: string;
		title?: string;
		size?: 'sm' | 'md';
		iconOnly?: boolean;
	}

	let { status, label, title, size = 'sm', iconOnly = false }: Props = $props();

	const statusConfig = {
		recurring: {
			label: 'Recurring',
			classes:
				'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-400',
			icon: RefreshCcw
		},
		'one-time': {
			label: 'One-Time',
			classes:
				'border-gray-200 bg-gray-100 text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300',
			icon: CircleDot
		},
		autopay: {
			label: 'Autopay',
			classes:
				'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400',
			icon: CreditCard
		},
		manual: {
			label: 'Manual',
			classes:
				'border-gray-200 bg-gray-100 text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300',
			icon: CircleDot
		},
		variable: {
			label: 'Variable',
			classes:
				'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-400',
			icon: CircleDollarSign
		},
		fixed: {
			label: 'Fixed',
			classes:
				'border-gray-200 bg-gray-100 text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300',
			icon: CircleDollarSign
		}
	};

	const config = $derived(statusConfig[status]);
	const Icon = $derived(config.icon);
	const text = $derived(label ?? config.label);
</script>

<span
	class={`inline-flex items-center rounded-full border font-medium leading-none ${config.classes} ${
		iconOnly
			? size === 'md'
				? 'p-2 text-sm'
				: 'p-1.5 text-xs'
			: size === 'md'
				? 'gap-1.5 px-3 py-1 text-sm'
				: 'gap-1.5 px-2.5 py-0.5 text-xs'
	}`}
	title={title ?? text}
	aria-label={text}
>
	<Icon class={size === 'md' ? 'h-3.5 w-3.5' : 'h-3 w-3'} />
	{#if !iconOnly}
		{text}
	{/if}
</span>
