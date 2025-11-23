<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import Navigation from '$lib/components/Navigation.svelte';
	import { initializeTheme } from '$lib/stores/theme.svelte';
	import type { ThemePreference } from '$lib/stores/theme.svelte';

	let { children, data } = $props();

	// Initialize theme immediately with server data (no onMount delay)
	initializeTheme(data.themePreference as ThemePreference);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900">
	<Navigation />
	<main>
		{@render children()}
	</main>
</div>
