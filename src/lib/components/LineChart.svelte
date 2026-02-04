<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		Chart,
		LineController,
		LineElement,
		PointElement,
		LinearScale,
		TimeScale,
		Tooltip,
		Filler
	} from 'chart.js';
	import 'chartjs-adapter-date-fns';
	import annotationPlugin from 'chartjs-plugin-annotation';

	Chart.register(LineController, LineElement, PointElement, LinearScale, TimeScale, Tooltip, Filler, annotationPlugin);

	interface Point {
		x: Date;
		y: number;
	}

	let {
		points,
		cycleBoundaries = [],
		rangeStart,
		rangeEnd,
		height = 220
	}: {
		points: Point[];
		cycleBoundaries?: Date[];
		rangeStart?: Date;
		rangeEnd?: Date;
		height?: number;
	} = $props();

	let canvas: HTMLCanvasElement | null = null;
	let chart: Chart | null = null;

	function renderChart() {
		if (!canvas) return;
		if (chart) {
			chart.destroy();
		}

		chart = new Chart(canvas, {
			type: 'line',
			data: {
				datasets: [
					{
						label: 'Payments',
						data: points,
						borderColor: '#3b82f6',
						backgroundColor: 'transparent',
						tension: 0,
						borderWidth: 2,
						pointRadius: 3.5,
						pointHoverRadius: 5,
						pointBackgroundColor: '#3b82f6',
						pointBorderWidth: 0
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				parsing: false,
				plugins: {
					legend: { display: false },
					tooltip: {
						enabled: true,
						displayColors: false,
						callbacks: {
							title: (items) => {
								const value = items[0]?.parsed?.x;
								return value ? new Date(value).toLocaleDateString() : '';
							},
							label: (item) => `$${Number(item.parsed?.y ?? 0).toFixed(2)}`
						}
					},
					annotation: {
						annotations: cycleBoundaries.map((date, index) => ({
							type: 'line',
							xMin: date,
							xMax: date,
							borderColor: 'rgba(148, 163, 184, 0.35)',
							borderWidth: 1,
							borderDash: [4, 4]
						}))
					}
				},
				scales: {
					x: {
						type: 'time',
						time: {
							unit: 'month',
							displayFormats: { month: 'MMM yyyy' }
						},
						grid: { display: false },
						min: rangeStart,
						max: rangeEnd,
						ticks: {
							maxTicksLimit: 6
						}
					},
					y: {
						beginAtZero: true,
						grid: { color: 'rgba(0,0,0,0.06)' },
						ticks: {
							callback: (value) => `$${value}`
						}
					}
				}
			}
		});
	}

	$effect(() => {
		if (canvas) {
			renderChart();
		}
	});

	onMount(() => {
		renderChart();
	});

	onDestroy(() => {
		if (chart) chart.destroy();
	});
</script>

<div class="w-full" style={`height: ${height}px`}>
	<canvas bind:this={canvas}></canvas>
</div>
