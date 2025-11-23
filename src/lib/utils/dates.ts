/**
 * Date utility functions to handle timezone-safe date operations
 */

/**
 * Parses a date-only string (YYYY-MM-DD) as local midnight instead of UTC midnight.
 * This prevents off-by-one day errors when working with date inputs.
 *
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns Date object set to local midnight
 *
 * @example
 * parseLocalDate('2025-01-15') // Returns Jan 15, 2025 00:00:00 in local timezone
 */
export function parseLocalDate(dateString: string): Date {
	const [year, month, day] = dateString.split('-').map(Number);
	return new Date(year, month - 1, day);
}

/**
 * Formats a Date object to YYYY-MM-DD in local time.
 * This is safer than using .toISOString().split('T')[0] which uses UTC.
 *
 * @param date - Date object to format
 * @returns Date string in YYYY-MM-DD format
 *
 * @example
 * formatDateForInput(new Date(2025, 0, 15)) // Returns '2025-01-15'
 */
export function formatDateForInput(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}
