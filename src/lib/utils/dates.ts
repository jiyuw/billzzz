/**
 * Date utility functions to handle timezone-safe date operations
 */

import { format, isValid, startOfDay } from 'date-fns';

/**
 * Parses a date-only string (YYYY-MM-DD) as local midnight instead of UTC midnight.
 * This prevents off-by-one day errors when working with date inputs.
 *
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns Date object set to local midnight
 * @throws Error if dateString is invalid or results in an invalid Date
 *
 * @example
 * parseLocalDate('2025-01-15') // Returns Jan 15, 2025 00:00:00 in local timezone
 */
export function parseLocalDate(dateString: string): Date {
	// Validate input
	if (!dateString || typeof dateString !== 'string') {
		throw new Error(`Invalid date string: expected non-empty string, got ${typeof dateString}`);
	}

	const trimmed = dateString.trim();
	if (trimmed === '') {
		throw new Error('Invalid date string: empty string');
	}

	// Parse the date
	const parts = trimmed.split('-');
	if (parts.length !== 3) {
		throw new Error(`Invalid date format: expected YYYY-MM-DD, got "${trimmed}"`);
	}

	const [year, month, day] = parts.map(Number);

	// Check for NaN values
	if (isNaN(year) || isNaN(month) || isNaN(day)) {
		throw new Error(`Invalid date components: year=${year}, month=${month}, day=${day}`);
	}

	// Create the date
	const date = new Date(year, month - 1, day);

	// Reject JavaScript's implicit rollover for values such as 2026-02-31.
	if (
		isNaN(date.getTime()) ||
		date.getFullYear() !== year ||
		date.getMonth() !== month - 1 ||
		date.getDate() !== day
	) {
		throw new Error(`Invalid date: ${trimmed} resulted in Invalid Date`);
	}

	return date;
}

/**
 * Parses a datetime-local value (YYYY-MM-DDTHH:mm) as a local Date.
 */
export function parseLocalDateTime(dateTimeString: string): Date {
	if (!dateTimeString || typeof dateTimeString !== 'string') {
		throw new Error(`Invalid datetime string: expected non-empty string, got ${typeof dateTimeString}`);
	}

	const trimmed = dateTimeString.trim();
	if (trimmed === '') {
		throw new Error('Invalid datetime string: empty string');
	}

	const [datePart, timePart] = trimmed.split('T');
	if (!datePart || !timePart) {
		throw new Error(`Invalid datetime format: expected YYYY-MM-DDTHH:mm, got "${trimmed}"`);
	}

	const baseDate = parseLocalDate(datePart);
	const [hours, minutes] = timePart.split(':').map(Number);

	if (Number.isNaN(hours) || Number.isNaN(minutes)) {
		throw new Error(`Invalid time components: hour=${hours}, minute=${minutes}`);
	}

	baseDate.setHours(hours, minutes, 0, 0);

	if (!isValid(baseDate)) {
		throw new Error(`Invalid datetime: ${trimmed} resulted in Invalid Date`);
	}

	return baseDate;
}

/**
 * Converts mixed incoming date values into a Date for storage.
 * Date-only values use UTC midnight as a timezone-independent calendar-day encoding.
 */
export function normalizeDateForStorage(
	value: Date | string,
	options: { kind: 'date'; boundary?: 'start' | 'end' } | { kind: 'datetime' }
): Date {
	const date =
		value instanceof Date
			? new Date(value.getTime())
			: options.kind === 'datetime'
				? parseLocalDateTime(value)
				: parseLocalDate(value);

	if (!isValid(date)) {
		throw new Error('Invalid date value for storage');
	}

	if (options.kind === 'datetime') {
		return date;
	}

	return encodeStoredCalendarDate(date);
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

/**
 * Formats a stored calendar date while supporting both storage conventions found
 * in databases:
 * - canonical date-only values stored at UTC midnight
 * - historical values stored at the server's local start/end-of-day boundary
 */
export function formatStoredDate(date: Date, pattern = 'MMM d, yyyy'): string {
	return format(decodeStoredCalendarDate(date), pattern);
}

/**
 * Decodes a persisted date boundary into the local calendar day the user
 * selected. Canonical rows use UTC midnight; historical rows use local boundaries.
 */
export function decodeStoredCalendarDate(date: Date): Date {
	const isLegacyUtcMidnight =
		date.getUTCHours() === 0 &&
		date.getUTCMinutes() === 0 &&
		date.getUTCSeconds() === 0 &&
		date.getUTCMilliseconds() === 0;
	return isLegacyUtcMidnight
		? new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
		: startOfDay(date);
}

/**
 * Encodes a calendar date as UTC midnight so a server and browser in different
 * timezones still agree on the selected YYYY-MM-DD value.
 */
export function encodeStoredCalendarDate(date: Date): Date {
	const calendarDate = decodeStoredCalendarDate(date);
	return new Date(
		Date.UTC(
			calendarDate.getFullYear(),
			calendarDate.getMonth(),
			calendarDate.getDate()
		)
	);
}

/**
 * Formats a stored calendar date for a date input.
 */
export function formatStoredDateForInput(date: Date): string {
	return formatStoredDate(date, 'yyyy-MM-dd');
}

/**
 * Formats a Date for use in a datetime-local input using the current device timezone.
 */
export function formatDateTimeForInput(date: Date): string {
	return format(date, "yyyy-MM-dd'T'HH:mm");
}
