<script lang="ts">
	import { Home, Car } from 'lucide-svelte';

	let { tag }: { tag?: { id: number; name: string; type?: 'house' | 'vehicle' | null; color?: string | null } | null } = $props();

	const iconMap = {
		house: Home,
		vehicle: Car
	};

	const IconComponent = $derived(tag?.type ? iconMap[tag.type] : null);
</script>

{#if tag}
	<span
		class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium leading-none"
		style="background-color: {tag.color ? `${tag.color}20` : 'rgba(243, 244, 246, 1)'}; color: {tag.color ?? '#6b7280'}; border-color: {tag.color ? `${tag.color}40` : 'rgba(209, 213, 219, 1)'};"
	>
		{#if IconComponent}
			<IconComponent size={12} />
		{/if}
		{tag.name}
	</span>
{/if}
