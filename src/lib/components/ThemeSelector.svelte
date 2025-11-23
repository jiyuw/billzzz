<script lang="ts">
	import { Sun, Moon, Monitor } from 'lucide-svelte';
	import { themeStore, setPreference } from '$lib/stores/theme.svelte';
	import type { ThemePreference } from '$lib/stores/theme.svelte';

	// Get current theme preference (reactive) - directly accessing the object property
	let currentTheme = $derived(themeStore.preference);

	// Handle theme change
	async function handleThemeChange(theme: ThemePreference) {
		try {
			// Update local state immediately
			setPreference(theme);

			// Persist to database
			const response = await fetch('/api/preferences', {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ themePreference: theme })
			});

			if (!response.ok) {
				console.error('Failed to save theme preference');
			}
		} catch (error) {
			console.error('Error saving theme preference:', error);
		}
	}

	const themes: { value: ThemePreference; label: string; icon: any }[] = [
		{ value: 'light', label: 'Light', icon: Sun },
		{ value: 'dark', label: 'Dark', icon: Moon },
		{ value: 'system', label: 'System', icon: Monitor }
	];
</script>

<div class="space-y-2">
	<p class="block text-sm font-medium text-gray-700 dark:text-gray-300">Theme</p>
	<div class="grid grid-cols-3 gap-2">
		{#each themes as theme}
			{@const Icon = theme.icon}
			<button
				type="button"
				onclick={() => handleThemeChange(theme.value)}
				class="flex flex-col items-center justify-center gap-2 rounded-lg border-2 p-4 transition-all {currentTheme ===
				theme.value
					? 'border-blue-500 bg-blue-50 dark:bg-blue-950 dark:border-blue-400'
					: 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600'}"
			>
				<Icon
					class="h-6 w-6 {currentTheme === theme.value
						? 'text-blue-600 dark:text-blue-400'
						: 'text-gray-600 dark:text-gray-400'}"
				/>
				<span
					class="text-sm font-medium {currentTheme === theme.value
						? 'text-blue-700 dark:text-blue-300'
						: 'text-gray-700 dark:text-gray-300'}"
				>
					{theme.label}
				</span>
			</button>
		{/each}
	</div>
	<p class="text-xs text-gray-500 dark:text-gray-400">
		Choose your preferred color scheme. System will use your device's theme setting.
	</p>
</div>
