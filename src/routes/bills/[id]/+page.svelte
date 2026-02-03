<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import { formatCurrency } from '$lib/utils/format';
	import { format } from 'date-fns';
	import { ArrowLeft, Calendar, DollarSign, TrendingUp } from 'lucide-svelte';

	let { data }: { data: PageData } = $props();

	const bill = $derived(data.bill);
	const currentCycle = $derived(bill.currentCycle);
	const cycles = $derived(data.cycles);
	const payments = $derived(data.payments);
	const displayCycles = $derived.by(() => cycles.filter((cycle) => cycle.totalPaid > 0));
	const historyStats = $derived.by(() => {
		if (displayCycles.length === 0) return null;
		const values = displayCycles.map((cycle) => cycle.totalPaid);
		const total = values.reduce((sum, value) => sum + value, 0);
		const average = total / values.length;
		const min = Math.min(...values);
		const max = Math.max(...values);
		const lastAmount = values[values.length - 1];
		return { count: values.length, average, min, max, lastAmount };
	});
	const historyCycles = $derived.by(() =>
		[...displayCycles]
			.sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
			.slice(-12)
	);

	const chartWidth = 640;
	const chartHeight = 200;
	const chartPadding = { top: 16, right: 16, bottom: 24, left: 32 };
	let hoverIndex = $state<number | null>(null);
	let tooltipX = $state(0);
	let tooltipY = $state(0);

	const chartValues = $derived.by(() => historyCycles.map((cycle) => cycle.totalPaid));
	const chartMax = $derived.by(() => Math.max(1, ...chartValues));
	const chartMin = 0;
	const chartX = $derived.by(() => (index: number) => {
		if (historyCycles.length <= 1) {
			return (chartWidth - chartPadding.left - chartPadding.right) / 2;
		}
		return (
			(index / (historyCycles.length - 1)) *
			(chartWidth - chartPadding.left - chartPadding.right)
		);
	});
	const chartY = $derived.by(() => (value: number) =>
		(chartHeight - chartPadding.top - chartPadding.bottom) -
		((value - chartMin) / (chartMax - chartMin)) *
			(chartHeight - chartPadding.top - chartPadding.bottom)
	);
	const linePath = $derived.by(() =>
		historyCycles
			.map((cycle, index) => {
				const x = chartX(index);
				const y = chartY(cycle.totalPaid);
				return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
			})
			.join(' ')
	);

	function handleChartMove(event: MouseEvent) {
		if (historyCycles.length === 0) return;
		const svg = event.currentTarget as SVGElement;
		const rect = svg.getBoundingClientRect();
		const x = event.clientX - rect.left - chartPadding.left;
		const y = event.clientY - rect.top;
		const chartInnerWidth = chartWidth - chartPadding.left - chartPadding.right;
		if (x < 0 || x > chartInnerWidth) {
			hoverIndex = null;
			return;
		}
		const index = Math.round((x / chartInnerWidth) * (historyCycles.length - 1));
		hoverIndex = Math.max(0, Math.min(historyCycles.length - 1, index));
		tooltipX = event.clientX - rect.left;
		tooltipY = y;
	}

	function handleChartLeave() {
		hoverIndex = null;
	}


	// Group payments by cycle
	const paymentsByCycle = $derived.by(() => payments.reduce((acc, payment) => {
		if (!acc[payment.cycleId]) {
			acc[payment.cycleId] = [];
		}
		acc[payment.cycleId].push(payment);
		return acc;
	}, {} as Record<number, typeof payments>));

	function getCycleName(cycle: typeof cycles[0]) {
		const start = format(cycle.startDate, 'MMM d, yyyy');
		const end = format(cycle.endDate, 'MMM d, yyyy');
		return `${start} - ${end}`;
	}

	function getProgressPercentage(totalPaid: number, expectedAmount: number) {
		return expectedAmount > 0 ? Math.min((totalPaid / expectedAmount) * 100, 100) : 0;
	}

	function getStatusColor(isPaid: boolean, totalPaid: number, expectedAmount: number) {
		if (isPaid || totalPaid >= expectedAmount) return 'bg-green-500';
		if (totalPaid > 0) return 'bg-yellow-500';
		return 'bg-gray-300 dark:bg-gray-600';
	}
</script>

<div class="container mx-auto px-4 py-8 max-w-6xl">
	<!-- Header -->
	<div class="mb-6">
		<button
			onclick={() => goto('/')}
			class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-4"
		>
			<ArrowLeft class="w-4 h-4" />
			Back to Bills
		</button>

		<div class="flex items-start justify-between">
			<div>
				<h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">{bill.name}</h1>
				<p class="text-gray-600 dark:text-gray-400 mt-1">
					{#if bill.isRecurring}
						Recurring {bill.recurrenceType} • Due {format(bill.dueDate, 'MMM d, yyyy')}
					{:else}
						One-time bill • Due {format(bill.dueDate, 'MMM d, yyyy')}
					{/if}
				</p>
			</div>
			{#if !bill.isVariable}
				<div class="text-right">
					<p class="text-sm text-gray-600 dark:text-gray-400">Expected Amount</p>
					<p class="text-2xl font-bold text-gray-900 dark:text-gray-100">
						{formatCurrency(bill.amount)}
					</p>
				</div>
			{/if}
		</div>
	</div>

	<!-- Current Cycle Card -->
	{#if currentCycle}
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
			<div class="flex items-center gap-2 mb-4">
				<Calendar class="w-5 h-5 text-blue-600 dark:text-blue-400" />
				<h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Current Cycle</h2>
			</div>

			<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
				<div>
					<p class="text-sm text-gray-600 dark:text-gray-400">Period</p>
					<p class="text-lg font-medium text-gray-900 dark:text-gray-100">
						{format(currentCycle.startDate, 'MMM d')} - {format(currentCycle.endDate, 'MMM d, yyyy')}
					</p>
				</div>
				<div>
					<p class="text-sm text-gray-600 dark:text-gray-400">Total Paid</p>
					<p class="text-lg font-medium text-gray-900 dark:text-gray-100">
						{bill.isVariable && currentCycle.totalPaid === 0
							? 'Unpaid'
							: formatCurrency(currentCycle.totalPaid)}
					</p>
				</div>
				<div>
					<p class="text-sm text-gray-600 dark:text-gray-400">Remaining</p>
					<p class="text-lg font-medium text-gray-900 dark:text-gray-100">
						{formatCurrency(currentCycle.remaining)}
					</p>
				</div>
			</div>

			{#if !bill.isVariable}
				<!-- Progress Bar -->
				<div class="mb-2">
					<div class="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
						<span>Progress</span>
						<span>{currentCycle.percentPaid.toFixed(0)}%</span>
					</div>
					<div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
						<div
							class="h-3 rounded-full transition-all {getStatusColor(
								currentCycle.isPaid,
								currentCycle.totalPaid,
								currentCycle.expectedAmount
							)}"
							style="width: {currentCycle.percentPaid}%"
						></div>
					</div>
				</div>
			{/if}

			<!-- Current Cycle Payments -->
			{#if paymentsByCycle[currentCycle.id]?.length > 0}
				<div class="mt-4">
					<h3 class="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
						Payments This Cycle
					</h3>
					<div class="space-y-2">
						{#each paymentsByCycle[currentCycle.id] as payment}
							<div
								class="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700 rounded"
							>
								<div class="flex items-center gap-3">
									<DollarSign class="w-4 h-4 text-green-600 dark:text-green-400" />
									<div>
										<p class="text-sm font-medium text-gray-900 dark:text-gray-100">
											{formatCurrency(payment.amount)}
										</p>
										{#if payment.notes}
											<p class="text-xs text-gray-600 dark:text-gray-400">{payment.notes}</p>
										{/if}
									</div>
								</div>
								<p class="text-sm text-gray-600 dark:text-gray-400">
									{format(payment.paymentDate, 'MMM d, yyyy')}
								</p>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	{:else}
		<div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
			<p class="text-sm text-yellow-800 dark:text-yellow-200">
				No current billing cycle. Cycles will be generated automatically when payments are recorded.
			</p>
		</div>
	{/if}

	<!-- Cycle History -->
	{#if displayCycles.length > 0}
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
			<div class="flex items-center gap-2 mb-4">
				<TrendingUp class="w-5 h-5 text-purple-600 dark:text-purple-400" />
				<h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Payment History</h2>
			</div>

			{#if bill.isVariable && historyStats}
				<div class="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
					<div class="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
						<p class="text-xs text-gray-500 dark:text-gray-400">Avg</p>
						<p class="text-lg font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(historyStats.average)}</p>
					</div>
					<div class="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
						<p class="text-xs text-gray-500 dark:text-gray-400">Min</p>
						<p class="text-lg font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(historyStats.min)}</p>
					</div>
					<div class="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
						<p class="text-xs text-gray-500 dark:text-gray-400">Max</p>
						<p class="text-lg font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(historyStats.max)}</p>
					</div>
					<div class="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
						<p class="text-xs text-gray-500 dark:text-gray-400">Last</p>
						<p class="text-lg font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(historyStats.lastAmount)}</p>
					</div>
					<div class="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
						<p class="text-xs text-gray-500 dark:text-gray-400">Cycles</p>
						<p class="text-lg font-semibold text-gray-900 dark:text-gray-100">{historyStats.count}</p>
					</div>
				</div>
			{/if}

			{#if historyCycles.length > 0}
				<div class="mb-6 relative">
					<p class="text-sm text-gray-600 dark:text-gray-400 mb-2">Last {historyCycles.length} cycles</p>
					<div class="w-full overflow-x-auto">
						<svg
							viewBox={`0 0 ${chartWidth} ${chartHeight}`}
							class="w-full h-52"
							role="img"
							aria-label="Payment history line chart"
							onmousemove={handleChartMove}
							onmouseleave={handleChartLeave}
						>
							<defs>
								<linearGradient id="historyLine" x1="0%" y1="0%" x2="100%" y2="0%">
									<stop offset="0%" stop-color="#60a5fa" />
									<stop offset="100%" stop-color="#3b82f6" />
								</linearGradient>
								<linearGradient id="historyFill" x1="0%" y1="0%" x2="0%" y2="100%">
									<stop offset="0%" stop-color="#93c5fd" stop-opacity="0.35" />
									<stop offset="100%" stop-color="#93c5fd" stop-opacity="0" />
								</linearGradient>
							</defs>
							<g transform={`translate(${chartPadding.left}, ${chartPadding.top})`}>
								<line
									x1="0"
									y1={chartHeight - chartPadding.top - chartPadding.bottom}
									x2={chartWidth - chartPadding.left - chartPadding.right}
									y2={chartHeight - chartPadding.top - chartPadding.bottom}
									stroke="currentColor"
									stroke-opacity="0.15"
								/>
								<path
									d={`${linePath} L ${chartWidth - chartPadding.left - chartPadding.right} ${chartHeight - chartPadding.top - chartPadding.bottom} L 0 ${chartHeight - chartPadding.top - chartPadding.bottom} Z`}
									fill="url(#historyFill)"
								/>
								<path
									d={linePath}
									fill="none"
									stroke="url(#historyLine)"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								/>
								{#each historyCycles as cycle, index}
									{#if index === historyCycles.length - 1}
										<circle
											cx={chartX(index)}
											cy={chartY(cycle.totalPaid)}
											r="5"
											fill="#3b82f6"
											stroke="white"
											stroke-width="2"
										/>
									{:else}
										<circle
											cx={chartX(index)}
											cy={chartY(cycle.totalPaid)}
											r="2.5"
											fill="#93c5fd"
											fill-opacity="0.9"
										/>
									{/if}
								{/each}
							</g>
						</svg>
					</div>
					{#if hoverIndex !== null}
						<div
							class="pointer-events-none absolute z-10 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
							style="left: {Math.min(Math.max(tooltipX + 8, 8), chartWidth - 120)}px; top: {Math.max(tooltipY - 36, 8)}px;"
						>
							<div>
								{format(historyCycles[hoverIndex].startDate, 'MMM d, yyyy')} – {format(historyCycles[hoverIndex].endDate, 'MMM d, yyyy')}
							</div>
							<div class="font-semibold">{formatCurrency(historyCycles[hoverIndex].totalPaid)}</div>
						</div>
					{/if}
					<div class="mt-2 flex justify-between text-xs text-gray-500 dark:text-gray-400">
						<span>{format(historyCycles[0].startDate, 'MMM yyyy')}</span>
						<span>{format(historyCycles[historyCycles.length - 1].startDate, 'MMM yyyy')}</span>
					</div>
				</div>
			{/if}

			<div class="space-y-4">
				{#each displayCycles as cycle}
					<div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
						<div class="flex items-center justify-between mb-3">
							<div>
								<h3 class="font-medium text-gray-900 dark:text-gray-100">
									{getCycleName(cycle)}
								</h3>
								{#if !bill.isVariable}
									<p class="text-sm text-gray-600 dark:text-gray-400">
										Expected: {formatCurrency(cycle.expectedAmount)}
									</p>
								{/if}
							</div>
							<div class="text-right">
								<p class="text-lg font-semibold text-gray-900 dark:text-gray-100">
									{formatCurrency(cycle.totalPaid)}
								</p>
								{#if cycle.isPaid}
									<span class="text-xs text-green-600 dark:text-green-400 font-medium">Paid</span>
								{:else if cycle.totalPaid > 0}
									<span class="text-xs text-yellow-600 dark:text-yellow-400 font-medium">
										Partial ({getProgressPercentage(cycle.totalPaid, cycle.expectedAmount).toFixed(0)}%)
									</span>
								{:else}
									<span class="text-xs text-gray-500 dark:text-gray-400">Unpaid</span>
								{/if}
							</div>
						</div>

						<!-- Payments in this cycle -->
						{#if paymentsByCycle[cycle.id]?.length > 0}
							<div class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
								<div class="space-y-1">
									{#each paymentsByCycle[cycle.id] as payment}
										<div class="flex items-center justify-between text-sm">
											<span class="text-gray-600 dark:text-gray-400">
												{format(payment.paymentDate, 'MMM d, yyyy')}
												{#if payment.notes}
													<span class="text-xs">• {payment.notes}</span>
												{/if}
											</span>
											<span class="font-medium text-gray-900 dark:text-gray-100">
												{formatCurrency(payment.amount)}
											</span>
										</div>
									{/each}
								</div>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	{:else}
		<div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-8 text-center">
			<p class="text-gray-600 dark:text-gray-400">No payment history yet</p>
		</div>
	{/if}
</div>
