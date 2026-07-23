type CycleLike = {
	id: number;
	startDate: Date | string | number;
	endDate: Date | string | number;
	isPaid: boolean;
	totalPaid: number;
};

type NormalizedCycle<T extends CycleLike> = Omit<T, 'startDate' | 'endDate'> & {
	startDate: Date;
	endDate: Date;
};

function normalizeCycleDate(value: Date | string | number): Date {
	return value instanceof Date ? value : new Date(value);
}

export function normalizePaymentCycles<T extends CycleLike>(
	input: T[]
): Array<NormalizedCycle<T>> {
	return input
		.map((cycle) => ({
			...cycle,
			startDate: normalizeCycleDate(cycle.startDate),
			endDate: normalizeCycleDate(cycle.endDate)
		}))
		.sort((left, right) => {
			const byEnd = right.endDate.getTime() - left.endDate.getTime();
			return byEnd === 0 ? right.id - left.id : byEnd;
		});
}

export function getInitialSelectedCycleId<T extends CycleLike>(params: {
	cycles: Array<NormalizedCycle<T>>;
	selectedCycleId?: number | null;
	existingPaymentCycleId?: number | null;
}): number | null {
	const {
		cycles,
		selectedCycleId = null,
		existingPaymentCycleId = null
	} = params;

	if (existingPaymentCycleId !== null) {
		const existing = cycles.find((cycle) => cycle.id === existingPaymentCycleId);
		if (existing) return existing.id;
	}

	if (selectedCycleId !== null) {
		const selected = cycles.find((cycle) => cycle.id === selectedCycleId);
		if (selected) return selected.id;
	}

	return cycles[0]?.id ?? null;
}
