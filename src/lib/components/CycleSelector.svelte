<script lang="ts">
	import type { BillCycle } from '$lib/server/db/schema';
	import {
		buildCycleTimeline,
		cycleLane,
		cyclePosition,
		dragBoundaryDate,
		previewCycleBoundary
	} from './cycle-selector-utils';
	import { findCycleConflicts } from '$lib/utils/manual-cycles';
	import { format } from 'date-fns';
	import { onDestroy } from 'svelte';
	import { Plus, Trash2 } from 'lucide-svelte';
	import {
		decodeStoredCalendarDate,
		formatStoredDate,
		formatStoredDateForInput,
		parseLocalDate
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
		onDelete: (cycleId: number) => void | Promise<void>;
		isSaving?: boolean;
		error?: string;
	}

	let {
		cycles,
		selectedCycleId,
		onSelect,
		onAdd,
		onResize,
		onDelete,
		isSaving = false,
		error = ''
	}: Props = $props();

	const timeline = $derived(buildCycleTimeline(cycles));
	const conflicts = $derived(findCycleConflicts(cycles));
	const selectedCycle = $derived(
		cycles.find((cycle) => cycle.id === selectedCycleId) ?? null
	);
	const timelineWidth = $derived(Math.max(720, timeline.dayCount * 18));
	let dragPreview = $state<{
		id: number;
		startDate: Date;
		endDate: Date;
		side: 'start' | 'end';
		pointerPercent: number;
	} | null>(null);
	let activeDragCleanup: (() => void) | null = null;
	onDestroy(() => activeDragCleanup?.());
	const selectedDisplayCycle = $derived(
		selectedCycle && dragPreview?.id === selectedCycle.id
			? dragPreview
			: selectedCycle
	);
	let startDateDraft = $state('');
	let endDateDraft = $state('');
	let editingBoundary = $state<'start' | 'end' | null>(null);
	let draftCycleId = $state<number | null>(null);

	$effect(() => {
		const displayCycleId = selectedDisplayCycle?.id ?? null;
		const savedStartDate = selectedDisplayCycle
			? formatStoredDateForInput(selectedDisplayCycle.startDate)
			: '';
		const savedEndDate = selectedDisplayCycle
			? formatStoredDateForInput(selectedDisplayCycle.endDate)
			: '';
		if (displayCycleId !== draftCycleId) {
			draftCycleId = displayCycleId;
			editingBoundary = null;
			startDateDraft = savedStartDate;
			endDateDraft = savedEndDate;
			return;
		}
		if (editingBoundary !== 'start') startDateDraft = savedStartDate;
		if (editingBoundary !== 'end') endDateDraft = savedEndDate;
	});

	function previewAtPointer(
		event: PointerEvent,
		container: HTMLElement,
		boundaryDate: Date,
		originClientX: number
	) {
		const rect = container.getBoundingClientRect();
		const fraction = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
		const unclampedDate = dragBoundaryDate(
			boundaryDate,
			originClientX,
			event.clientX,
			rect.width / timeline.dayCount
		);
		const timestamp = Math.min(
			Math.max(unclampedDate.getTime(), timeline.startDate.getTime()),
			timeline.endDate.getTime()
		);
		return {
			date: new Date(timestamp),
			pointerPercent: fraction * 100
		};
	}

	function beginResize(
		event: PointerEvent,
		cycle: BillCycle,
		side: 'start' | 'end'
	) {
		if (editingBoundary || isSaving) return;
		event.preventDefault();
		event.stopPropagation();
		const container = (event.currentTarget as HTMLElement).closest(
			'[data-cycle-timeline]'
		) as HTMLElement | null;
		if (!container) return;
		const originClientX = event.clientX;
		const boundaryDate = decodeStoredCalendarDate(
			side === 'start' ? cycle.startDate : cycle.endDate
		);

		const handleMove = (moveEvent: PointerEvent) => {
			const { date: nextDate, pointerPercent } = previewAtPointer(
				moveEvent,
				container,
				boundaryDate,
				originClientX
			);
			const previewCycle = previewCycleBoundary(cycle, side, nextDate);
			if (!previewCycle) return;
			dragPreview = { ...previewCycle, side, pointerPercent };
		};

		const cleanup = () => {
			window.removeEventListener('pointermove', handleMove);
			window.removeEventListener('pointerup', handleUp);
			window.removeEventListener('pointercancel', handleCancel);
			if (activeDragCleanup === cleanup) activeDragCleanup = null;
		};

		const handleCancel = () => {
			cleanup();
			dragPreview = null;
		};

		const handleUp = async (upEvent: PointerEvent) => {
			cleanup();
			const { date: nextDate, pointerPercent } = previewAtPointer(
				upEvent,
				container,
				boundaryDate,
				originClientX
			);
			const previewCycle = previewCycleBoundary(cycle, side, nextDate);
			if (!previewCycle) {
				dragPreview = null;
				return;
			}
			dragPreview = { ...previewCycle, side, pointerPercent };
			try {
				await onResize({
					cycleId: cycle.id,
					side,
					date: format(nextDate, 'yyyy-MM-dd')
				});
			} finally {
				dragPreview = null;
			}
		};

		activeDragCleanup?.();
		activeDragCleanup = cleanup;
		handleMove(event);
		window.addEventListener('pointermove', handleMove);
		window.addEventListener('pointerup', handleUp, { once: true });
		window.addEventListener('pointercancel', handleCancel, { once: true });
	}

	async function saveExactBoundary(side: 'start' | 'end', value: string) {
		if (!selectedCycle) return;
		const savedValue = formatStoredDateForInput(
			side === 'start' ? selectedCycle.startDate : selectedCycle.endDate
		);
		if (!value || value === savedValue) {
			if (side === 'start') startDateDraft = savedValue;
			else endDateDraft = savedValue;
			return;
		}
		try {
			parseLocalDate(value);
		} catch {
			if (side === 'start') startDateDraft = savedValue;
			else endDateDraft = savedValue;
			return;
		}
		await onResize({ cycleId: selectedCycle.id, side, date: value });
	}

	async function finishBoundaryEdit(side: 'start' | 'end', value: string) {
		try {
			await saveExactBoundary(side, value);
		} finally {
			if (editingBoundary === side) editingBoundary = null;
		}
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
		<button
			type="button"
			onclick={onAdd}
			disabled={isSaving}
			class="inline-flex min-h-9 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
		>
			<Plus size={16} class="text-blue-600 dark:text-blue-400" />
			<span>Add Cycle</span>
		</button>
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
				{#if dragPreview}
					<div
						aria-hidden="true"
						class="pointer-events-none absolute bottom-0 top-9 z-20 w-px bg-blue-500/60"
						style={`left: ${dragPreview.pointerPercent}%`}
					></div>
					<div
						aria-live="polite"
						class="pointer-events-none absolute top-10 z-30 -translate-x-1/2 rounded-md bg-gray-900 px-2 py-1 text-xs font-semibold whitespace-nowrap text-white shadow-lg dark:bg-gray-100 dark:text-gray-900"
						style={`left: clamp(44px, ${dragPreview.pointerPercent}%, calc(100% - 44px))`}
					>
						{formatStoredDate(
							dragPreview.side === 'start'
								? dragPreview.startDate
								: dragPreview.endDate
						)}
					</div>
				{/if}

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

				<div class="relative h-24">
					{#each [...cycles].sort((a, b) => decodeStoredCalendarDate(a.startDate).getTime() - decodeStoredCalendarDate(b.startDate).getTime()) as cycle, index}
						{@const displayCycle = dragPreview?.id === cycle.id ? dragPreview : cycle}
						{@const position = cyclePosition(displayCycle, timeline)}
						<button
							type="button"
							data-preview-cycle={cycle.id}
							data-cycle-lane={cycleLane(index)}
							onclick={() => onSelect(cycle.id)}
							class={`absolute flex h-9 items-center rounded-xl px-3 text-left text-xs font-semibold shadow-sm transition ${
								cycle.id === selectedCycleId
									? 'z-10 bg-blue-700 text-white ring-2 ring-blue-300 dark:bg-blue-600 dark:ring-blue-500'
									: 'bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-200 dark:hover:bg-blue-900/60'
							}`}
							style={`left: ${position.left}%; top: ${12 + cycleLane(index) * 44}px; width: ${position.width}%`}
							title={`${formatStoredDate(displayCycle.startDate)} – ${formatStoredDate(displayCycle.endDate)}`}
						>
							{#if cycle.id === selectedCycleId}
								<span
									role="slider"
									aria-label="Adjust cycle start"
									aria-disabled={isSaving}
									aria-valuenow={displayCycle.startDate.getTime()}
									tabindex={isSaving ? -1 : 0}
									onpointerdown={(event) => beginResize(event, cycle, 'start')}
									class="absolute inset-y-0 left-0 w-3 cursor-ew-resize rounded-l-xl bg-blue-900/70"
								></span>
							{/if}
							<span class="truncate">
								{formatStoredDate(displayCycle.startDate, 'MMM d')} – {formatStoredDate(displayCycle.endDate, 'MMM d')}
							</span>
							{#if cycle.id === selectedCycleId}
								<span
									role="slider"
									aria-label="Adjust cycle end"
									aria-disabled={isSaving}
									aria-valuenow={displayCycle.endDate.getTime()}
									tabindex={isSaving ? -1 : 0}
									onpointerdown={(event) => beginResize(event, cycle, 'end')}
									class="absolute inset-y-0 right-0 w-3 cursor-ew-resize rounded-r-xl bg-blue-900/70"
								></span>
							{/if}
						</button>
					{/each}
				</div>
			</div>
		</div>
	{/if}

	{#if selectedCycle && selectedDisplayCycle}
		<div class="mt-5 grid gap-4 border-t border-gray-200 pt-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end dark:border-gray-700">
			<div>
				<label for="selectedCycleStart" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
					Start Date
				</label>
				<input
					id="selectedCycleStart"
					type="date"
					bind:value={startDateDraft}
					onfocus={() => (editingBoundary = 'start')}
					onblur={() => finishBoundaryEdit('start', startDateDraft)}
					onkeydown={(event) => {
						if (event.key === 'Enter') event.currentTarget.blur();
					}}
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
					bind:value={endDateDraft}
					onfocus={() => (editingBoundary = 'end')}
					onblur={() => finishBoundaryEdit('end', endDateDraft)}
					onkeydown={(event) => {
						if (event.key === 'Enter') event.currentTarget.blur();
					}}
					disabled={isSaving}
					class="mt-1 block w-full rounded-xl border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
				/>
			</div>
			<button
				type="button"
				aria-label="Delete selected cycle"
				title="Delete cycle"
				onclick={() => onDelete(selectedCycle.id)}
				disabled={isSaving}
				class="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-red-600 text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
			>
				<Trash2 size={17} />
			</button>
		</div>
	{/if}
</section>
