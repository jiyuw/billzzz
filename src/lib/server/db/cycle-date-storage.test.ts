import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';

const originalDataDirectory = process.env.DATA_DIR;
const originalTimezone = process.env.TZ;
const dataDirectory = mkdtempSync(join(tmpdir(), 'billtrack-cycle-date-test-'));

function restoreEnvironment() {
	if (originalDataDirectory === undefined) delete process.env.DATA_DIR;
	else process.env.DATA_DIR = originalDataDirectory;
	if (originalTimezone === undefined) delete process.env.TZ;
	else process.env.TZ = originalTimezone;
}

test('cycle queries normalize historical server-local boundaries for browser display', async () => {
	process.env.DATA_DIR = dataDirectory;
	process.env.TZ = 'America/Chicago';
	const vite = await createServer({ server: { middlewareMode: true }, logLevel: 'silent' });
	const dbModule = await vite.ssrLoadModule('/src/lib/server/db/index.ts');
	const { db } = dbModule;
	const { bills, billCycles } = await vite.ssrLoadModule('/src/lib/server/db/schema.ts');
	const { getCyclesForBill, getLatestCycleForBill } = await vite.ssrLoadModule(
		'/src/lib/server/db/bill-queries.ts'
	);
	const { formatStoredDateForInput } = await vite.ssrLoadModule('/src/lib/utils/dates.ts');

	try {
		const bill = db
			.insert(bills)
			.values({
				name: 'Timezone fixture',
				amount: 100,
				dueDate: new Date(2026, 10, 17)
			})
			.returning()
			.get();

		db.insert(billCycles)
			.values({
				billId: bill.id,
				startDate: new Date(2026, 9, 17, 0, 0, 0, 0),
				endDate: new Date(2026, 10, 16, 23, 59, 59, 999),
				expectedAmount: 100
			})
			.run();

		const cycles = await getCyclesForBill(bill.id);
		const latest = await getLatestCycleForBill(bill.id);

		process.env.TZ = 'America/Los_Angeles';
		assert.equal(formatStoredDateForInput(cycles[0].startDate), '2026-10-17');
		assert.equal(formatStoredDateForInput(cycles[0].endDate), '2026-11-16');
		assert.ok(latest);
		assert.equal(formatStoredDateForInput(latest.startDate), '2026-10-17');
		assert.equal(formatStoredDateForInput(latest.endDate), '2026-11-16');
	} finally {
		dbModule.sqlite?.close();
		await vite.close();
		rmSync(dataDirectory, { recursive: true, force: true });
		restoreEnvironment();
	}
});
