import type { RecurrenceUnit } from '$lib/types/bill';

/**
 * Get a human-readable description of the recurrence pattern
 * This is a shared utility that can be used in both client and server code
 */
export function getRecurrenceDescription(
	recurrenceInterval: number,
	recurrenceUnit: RecurrenceUnit,
	recurrenceDay?: number | null
): string {
	const unitLabel = recurrenceInterval === 1 ? recurrenceUnit : `${recurrenceUnit}s`;
	if ((recurrenceUnit === 'month' || recurrenceUnit === 'year') && recurrenceDay) {
		return `Every ${recurrenceInterval} ${unitLabel} on day ${recurrenceDay}`;
	}
	return `Every ${recurrenceInterval} ${unitLabel}`;
}
