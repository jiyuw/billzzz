<script lang="ts">
	import type { BillCycle } from '$lib/server/db/schema';
	import Button from '$lib/components/Button.svelte';
	import { buildCycleTimeline, cyclePosition } from './cycle-selector-utils';
	import { findCycleConflicts } from '$lib/utils/manual-cycles';
	import { addDays, format } from 'date-fns';
	import {
		decodeStoredCalendarDate,
		formatStoredDate,
		formatStoredDateForInput
	} from '$lib/utils/dates';

	interface Props {
		cycles: BillCycle[];
		selectedCycleId: number | null;
		onSelect: (cycleId: number) => void;
		onAdd: () => void | Promise<void>;
		onResize: (input: {
			cycleId: number;
			side: 'start' | 'end';
			date: string;
		}) => void | Promise<void>;
		isSaving?: boolean;
		error?: string;
	}

	let {
		cycles,
		selectedCycleId,
		onSelect,
		onAdd,
		onResize,
		isSaving = false,
		error = ''
	}: Props = $props();

	const timeline = $derived(buildCycleTimeline(cycles));
	const conflicts = $derived(findCycleConflicts(cycles));
	const selectedCycle = $derived(
		cycles.find((cycle) => cycle.id === selectedCycleId) ?? null
	);
	const timelineWidth = $derived(Math.max(720, timeline.dayCount * 18));

	function dateAtPointer(event: PointerEvent, container: HTMLElement): Date {
		const rect = container.getBoundingClientRect();
		const fraction = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
		const index = Math.min(Math.round(fraction * timeline.dayCount), timeline.dayCount - 1);
		return addDays(timeline.startDate, index);
	}

	function beginResize(
		event: PointerEvent,
		cycle: BillCycle,
		side: 'start' | 'end'
	) {
		event.preventDefault();
		event.stopPropagation();
		const container = (event.currentTarget as HTMLElement).closest(
			'[data-cycle-timeline]'
		) as HTMLElement | null;
		if (!container) return;
		const previewBar = container.querySelector(
			`[data-preview-cycle="${cycle.id}"]`
		) as HTMLElement | null;
		const originalLeft = previewBar?.style.left ?? '';
		const originalWidth = previewBar?.style.width ?? '';

		const restorePreview = () => {
			if (!previewBar) return;
			previewBar.style.left = originalLeft;
			previewBar.style.width = originalWidth;
		};

		const handleMove = (moveEvent: PointerEvent) => {
			const nextDate = dateAtPointer(moveEvent, container);
			if (!previewBar) return;

			const previewCycle = {
				...cycle,
				startDate: side === 'start' ? nextDate : cycle.startDate,
				endDate: side === 'end' ? nextDate : cycle.endDate
			};
			if (previewCycle.startDate > previewCycle.endDate) return;
			const preview = cyclePosition(previewCycle, timeline);
			previewBar.style.left = `${preview.left}%`;
			previewBar.style.width = `${preview.width}%`;
		};

		const handleUp = async (upEvent: PointerEvent) => {
			window.removeEventListener('pointermove', handleMove);
			window.removeEventListener('pointerup', handleUp);
			const nextDate = dateAtPointer(upEvent, container);
			if (
				(side === 'start' && nextDate > decodeStoredCalendarDate(cycle.endDate)) ||
				(side === 'end' && nextDate < decodeStoredCalendarDate(cycle.startDate))
			) {
				restorePreview();
				return;
			}
			try {
				await onResize({
					cycleId: cycle.id,
					side,
					date: format(nextDate, 'yyyy-MM-dd')
				});
			} finally {
				restorePreview();
			}
		};

		window.addEventListener('pointermove', handleMove);
		window.addEventListener('pointerup', handleUp, { once: true });
	}

	async function saveExactBoundary(side: 'start' | 'end', value: string) {
		if (!selectedCycle || !value) return;
		await onResize({ cycleId: selectedCycle.id, side, date: value });
	}
</script>

<section class="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800/80">
	<div class="flex flex-wrap items-start justify-between gap-4">
		<div>
			<p class="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
				Cycle Selector
			</p>
			<h2 class="mt-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
				Saved billing cycles
			</h2>
			<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
				Select a cycle to inspect it. Drag only the left or right handle to adjust a boundary.
			</p>
		</div>
		<Button variant="primary" size="sm" onclick={onAdd} disabled={isSaving}>
			Add Cycle
		</Button>
	</div>

	{#if conflicts.length > 0}
		<div class="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
			Some older cycles overlap or have gaps. Adjust their shared boundaries to review them.
		</div>
	{/if}

	{#if error}
		<div class="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
			{error}
		</div>
	{/if}

	{#if cycles.length === 0}
		<div class="mt-5 rounded-2xl border border-dashed border-gray-300 px-5 py-10 text-center dark:border-gray-600">
			<p class="font-medium text-gray-900 dark:text-gray-100">No cycles yet</p>
			<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
				Add the first cycle when you know its date range.
			</p>
		</div>
	{:else}
		<div class="mt-5 overflow-x-auto pb-2">
			<div
				data-cycle-timeline
				class="relative"
				style={`width: ${timelineWidth}px`}
			>
				<div class="flex h-9 border-b border-gray-200 dark:border-gray-700">
					{#each timeline.months as month}
						<div
							class="border-r border-gray-200 px-2 text-xs font-semibold text-gray-600 dark:border-gray-700 dark:text-gray-300"
							style={`width: ${(month.dayCount / timeline.dayCount) * 100}%`}
						>
							{month.label}
						</div>
					{/each}
				</div>

				<div
					class="absolute inset-x-0 bottom-0 top-9 pointer-events-none opacity-40"
					style={`background-image: repeating-linear-gradient(to right, transparent 0, transparent calc(${100 / timeline.dayCount}% - 1px), rgb(203 213 225) calc(${100 / timeline.dayCount}% - 1px), rgb(203 213 225) ${100 / timeline.dayCount}%);`}
				></div>

				<div class="relative space-y-2 py-3">
					{#each [...cycles].sort((a, b) => decodeStoredCalendarDate(a.startDate).getTime() - decodeStoredCalendarDate(b.startDate).getTime()) as cycle}
						{@const position = cyclePosition(cycle, timeline)}
						<div class="relative h-11">
							<button
								type="button"
								data-preview-cycle={cycle.id}
								onclick={() => onSelect(cycle.id)}
								class={`absolute top-1 flex h-9 items-center rounded-xl px-3 text-left text-xs font-semibold text-white shadow-sm transition ${
									cycle.id === selectedCycleId
										? 'bg-blue-700 ring-2 ring-blue-300 dark:ring-blue-500'
										: 'bg-blue-500 hover:bg-blue-600'
								}`}
								style={`left: ${position.left}%; width: ${position.width}%`}
								title={`${formatStoredDate(cycle.startDate)} – ${formatStoredDate(cycle.endDate)}`}
							>
								{#if cycle.id === selectedCycleId}
									<span
										role="slider"
										aria-label="Adjust cycle start"
										aria-valuenow={cycle.startDate.getTime()}
										tabindex="0"
										onpointerdown={(event) => beginResize(event, cycle, 'start')}
										class="absolute inset-y-0 left-0 w-3 cursor-ew-resize rounded-l-xl bg-blue-900/70"
									></span>
								{/if}
								<span class="truncate">
									{formatStoredDate(cycle.startDate, 'MMM d')} – {formatStoredDate(cycle.endDate, 'MMM d')}
								</span>
								{#if cycle.id === selectedCycleId}
									<span
										role="slider"
										aria-label="Adjust cycle end"
										aria-valuenow={cycle.endDate.getTime()}
										tabindex="0"
										onpointerdown={(event) => beginResize(event, cycle, 'end')}
										class="absolute inset-y-0 right-0 w-3 cursor-ew-resize rounded-r-xl bg-blue-900/70"
									></span>
								{/if}
							</button>
						</div>
					{/each}
				</div>
			</div>
		</div>
	{/if}

	{#if selectedCycle}
		<div class="mt-5 grid gap-4 border-t border-gray-200 pt-5 sm:grid-cols-2 dark:border-gray-700">
			<div>
				<label for="selectedCycleStart" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
					Start Date
				</label>
				<input
					id="selectedCycleStart"
					type="date"
					value={formatStoredDateForInput(selectedCycle.startDate)}
					onchange={(event) => saveExactBoundary('start', event.currentTarget.value)}
					disabled={isSaving}
					class="mt-1 block w-full rounded-xl border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
				/>
			</div>
			<div>
				<label for="selectedCycleEnd" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
					End Date
				</label>
				<input
					id="selectedCycleEnd"
					type="date"
					value={formatStoredDateForInput(selectedCycle.endDate)}
					onchange={(event) => saveExactBoundary('end', event.currentTarget.value)}
					disabled={isSaving}
					class="mt-1 block w-full rounded-xl border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
				/>
			</div>
		</div>
	{/if}
</section>
