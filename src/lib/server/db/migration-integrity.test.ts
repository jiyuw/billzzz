import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
	initializeSqliteDatabase,
	UnsupportedDatabaseError,
	verifyDatabaseIntegrity,
	verifyRequiredSchema
} from './migrations';

const migrationsFolder = join(process.cwd(), 'drizzle', 'migrations');

function temporaryDatabase() {
	const directory = mkdtempSync(join(tmpdir(), 'billtrack-migration-test-'));
	const path = join(directory, 'bills.db');
	const sqlite = new Database(path);
	sqlite.pragma('foreign_keys = ON');
	return {
		directory,
		path,
		sqlite,
		close() {
			sqlite.close();
			rmSync(directory, { recursive: true, force: true });
		}
	};
}

function createSupportedLegacySchema(
	sqlite: Database.Database,
	options: { metadata: 'tracked' | 'missing' | 'empty' }
) {
	sqlite.exec(`
		CREATE TABLE categories (
			id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
			name TEXT NOT NULL,
			color TEXT NOT NULL,
			icon TEXT,
			created_at INTEGER NOT NULL DEFAULT (unixepoch())
		);
		CREATE TABLE bills (
			id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
			name TEXT NOT NULL,
			amount REAL NOT NULL,
			due_date INTEGER NOT NULL,
			payment_link TEXT,
			category_id INTEGER,
			is_recurring INTEGER NOT NULL DEFAULT 0,
			recurrence_type TEXT,
			recurrence_day INTEGER,
			is_paid INTEGER NOT NULL DEFAULT 0,
			notes TEXT,
			created_at INTEGER NOT NULL DEFAULT (unixepoch()),
			updated_at INTEGER NOT NULL DEFAULT (unixepoch())
		);
		CREATE TABLE bill_cycles (
			id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
			bill_id INTEGER NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
			start_date INTEGER NOT NULL,
			end_date INTEGER NOT NULL,
			expected_amount REAL NOT NULL,
			total_paid REAL NOT NULL DEFAULT 0,
			is_paid INTEGER NOT NULL DEFAULT 0,
			created_at INTEGER NOT NULL DEFAULT (unixepoch()),
			updated_at INTEGER NOT NULL DEFAULT (unixepoch())
		);
		CREATE TABLE bill_payments (
			id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
			bill_id INTEGER NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
			cycle_id INTEGER NOT NULL REFERENCES bill_cycles(id) ON DELETE CASCADE,
			amount REAL NOT NULL,
			payment_date INTEGER NOT NULL,
			notes TEXT,
			created_at INTEGER NOT NULL DEFAULT (unixepoch()),
			updated_at INTEGER NOT NULL DEFAULT (unixepoch())
		);
		CREATE TABLE user_preferences (
			id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
			theme_preference TEXT NOT NULL DEFAULT 'system',
			created_at INTEGER NOT NULL DEFAULT (unixepoch()),
			updated_at INTEGER NOT NULL DEFAULT (unixepoch())
		);
		CREATE TABLE rental_payment_notifications (
			id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
			payment_id INTEGER NOT NULL REFERENCES bill_payments(id) ON DELETE CASCADE,
			is_notified INTEGER NOT NULL DEFAULT 0,
			notified_on INTEGER,
			created_at INTEGER NOT NULL DEFAULT (unixepoch()),
			updated_at INTEGER NOT NULL DEFAULT (unixepoch())
		);
		CREATE UNIQUE INDEX rental_payment_notifications_payment_id_unique
			ON rental_payment_notifications(payment_id);

		INSERT INTO categories (id, name, color) VALUES (11, 'Existing', '#123456');
		INSERT INTO bills (
			id, name, amount, due_date, category_id, is_recurring, recurrence_type, created_at, updated_at
		) VALUES (21, 'Preserved bill', 125.5, 1704067200, 11, 1, 'monthly', 1700000000, 1700000001);
		INSERT INTO bill_cycles (
			id, bill_id, start_date, end_date, expected_amount, total_paid, is_paid, created_at, updated_at
		) VALUES (31, 21, 1706745600, 1704067200, 125.5, 70, 0, 1700000002, 1700000003);
		INSERT INTO bill_payments (
			id, bill_id, cycle_id, amount, payment_date, notes, created_at, updated_at
		) VALUES (41, 21, 31, 70, 1705000000, 'keep exactly', 1700000004, 1700000005);
		INSERT INTO rental_payment_notifications (
			id, payment_id, is_notified, notified_on, created_at, updated_at
		) VALUES (51, 41, 1, 1706000000, 1700000006, 1700000007);
		INSERT INTO user_preferences (id, theme_preference) VALUES (61, 'dark');
	`);

	if (options.metadata !== 'missing') {
		sqlite.exec(`
			CREATE TABLE __drizzle_migrations (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				hash TEXT NOT NULL,
				created_at NUMERIC
			)
		`);
		if (options.metadata === 'tracked') {
			sqlite
				.prepare(
					'INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)'
				)
				.run('legacy-0000', 0);
		}
	}
}

function protectedRows(sqlite: Database.Database) {
	return {
		bills: sqlite
			.prepare(`
				SELECT id, name, amount, due_date, payment_link, category_id, is_recurring,
					recurrence_type, recurrence_day, is_paid, notes, created_at, updated_at
				FROM bills
				ORDER BY id
			`)
			.all(),
		cycles: sqlite.prepare('SELECT * FROM bill_cycles ORDER BY id').all(),
		payments: sqlite.prepare('SELECT * FROM bill_payments ORDER BY id').all(),
		notifications: sqlite
			.prepare('SELECT * FROM rental_payment_notifications ORDER BY id')
			.all()
	};
}

function cycleDeleteAction(sqlite: Database.Database) {
	const row = (
		sqlite.prepare("PRAGMA foreign_key_list('bill_payments')").all() as Array<{
			from: string;
			on_delete: string;
		}>
	).find((foreignKey) => foreignKey.from === 'cycle_id');
	return row?.on_delete.toUpperCase();
}

test('fresh migrations create the complete canonical schema immediately', () => {
	const fixture = temporaryDatabase();
	try {
		initializeSqliteDatabase(fixture.sqlite, migrationsFolder);
		assert.deepEqual(verifyDatabaseIntegrity(fixture.sqlite), {
			integrity: 'ok',
			foreignKeyViolations: []
		});
		assert.equal(cycleDeleteAction(fixture.sqlite), 'NO ACTION');
		assert.ok(
			fixture.sqlite
				.prepare(
					"SELECT 1 FROM sqlite_master WHERE type='table' AND name='activity_logs'"
				)
				.get()
		);
		assert.deepEqual(
			(
				fixture.sqlite.prepare("PRAGMA table_info('bills')").all() as Array<{
					name: string;
				}>
			)
				.map((column) => column.name)
				.filter((name) => name === 'cycle_start_date' || name === 'cycle_end_date'),
			[]
		);
		assert.equal(
			(
				fixture.sqlite.prepare("PRAGMA table_info('bill_cycles')").all() as Array<{
					name: string;
				}>
			).some((column) => column.name === 'due_date'),
			false
		);
	} finally {
		fixture.close();
	}
});

test('tracked legacy migration preserves rows and repairs cycle deletion behavior', () => {
	const fixture = temporaryDatabase();
	try {
		createSupportedLegacySchema(fixture.sqlite, { metadata: 'tracked' });
		const before = protectedRows(fixture.sqlite);
		initializeSqliteDatabase(fixture.sqlite, migrationsFolder);
		assert.deepEqual(protectedRows(fixture.sqlite), before);
		assert.equal(cycleDeleteAction(fixture.sqlite), 'NO ACTION');
		assert.throws(
			() => fixture.sqlite.prepare('DELETE FROM bill_cycles WHERE id = 31').run(),
			/FOREIGN KEY constraint failed/
		);
		assert.deepEqual(verifyDatabaseIntegrity(fixture.sqlite), {
			integrity: 'ok',
			foreignKeyViolations: []
		});
	} finally {
		fixture.close();
	}
});

for (const metadata of ['missing', 'empty'] as const) {
	test(`supported legacy schema with ${metadata} metadata is recovered idempotently`, () => {
		const fixture = temporaryDatabase();
		try {
			createSupportedLegacySchema(fixture.sqlite, { metadata });
			const before = protectedRows(fixture.sqlite);
			initializeSqliteDatabase(fixture.sqlite, migrationsFolder);
			const schemaAfterFirstRun = fixture.sqlite
				.prepare(
					"SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name"
				)
				.all();
			assert.deepEqual(protectedRows(fixture.sqlite), before);
			assert.equal(cycleDeleteAction(fixture.sqlite), 'NO ACTION');
			assert.equal(
				(
					fixture.sqlite
						.prepare('SELECT COUNT(*) AS count FROM __drizzle_migrations')
						.get() as { count: number }
				).count,
				1
			);

			initializeSqliteDatabase(fixture.sqlite, migrationsFolder);
			assert.deepEqual(protectedRows(fixture.sqlite), before);
			assert.deepEqual(
				fixture.sqlite
					.prepare(
						"SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name"
					)
					.all(),
				schemaAfterFirstRun
			);
		} finally {
			fixture.close();
		}
	});
}

test('unsupported pre-cycle database is rejected before any change', () => {
	const fixture = temporaryDatabase();
	try {
		fixture.sqlite.exec(`
			CREATE TABLE bills (
				id INTEGER PRIMARY KEY,
				name TEXT NOT NULL,
				amount REAL NOT NULL,
				due_date INTEGER NOT NULL
			);
			CREATE TABLE payment_history (
				id INTEGER PRIMARY KEY,
				bill_id INTEGER NOT NULL,
				amount REAL NOT NULL
			);
			INSERT INTO bills VALUES (1, 'Old bill', 25, 1700000000);
			INSERT INTO payment_history VALUES (2, 1, 25);
		`);
		const before = fixture.sqlite
			.serialize();
		const schemaBefore = fixture.sqlite
			.prepare(
				"SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name"
			)
			.all();

		assert.throws(
			() => initializeSqliteDatabase(fixture.sqlite, migrationsFolder),
			(error: unknown) =>
				error instanceof UnsupportedDatabaseError &&
				/bill_cycles.*bill_payments.*user_preferences/.test(error.message)
		);
		assert.deepEqual(
			fixture.sqlite
				.prepare(
					"SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name"
				)
				.all(),
			schemaBefore
		);
		assert.deepEqual(fixture.sqlite.serialize(), before);
	} finally {
		fixture.close();
	}
});

test('migration SQL never references the production database path', () => {
	const plan = readFileSync(
		join(process.cwd(), 'docs', 'superpowers', 'specs', '2026-07-23-database-migration-integrity-design.md'),
		'utf8'
	);
	assert.match(plan, /production `data\/bills\.db` path is never used/);
});

test('runtime delegates migration work and ignores obsolete cycle columns', () => {
	const indexSource = readFileSync(
		join(process.cwd(), 'src', 'lib', 'server', 'db', 'index.ts'),
		'utf8'
	);
	const schemaSource = readFileSync(
		join(process.cwd(), 'src', 'lib', 'server', 'db', 'schema.ts'),
		'utf8'
	);
	const querySource = readFileSync(
		join(process.cwd(), 'src', 'lib', 'server', 'db', 'queries.ts'),
		'utf8'
	);
	assert.match(indexSource, /initializeSqliteDatabase\(sqlite, migrationsFolder\)/);
	assert.doesNotMatch(indexSource, /ALTER TABLE/);
	assert.doesNotMatch(schemaSource, /cycleStartDate|cycleEndDate/);
	assert.doesNotMatch(
		schemaSource.match(/export const billCycles[\s\S]*?export const billPayments/)?.[0] ?? '',
		/dueDate/
	);
	assert.doesNotMatch(querySource, /cycleStartDate|cycleEndDate/);
});

test('database reset resolves its target from DATA_DIR', () => {
	const resetSource = readFileSync(
		join(process.cwd(), 'scripts', 'reset-db.ts'),
		'utf8'
	);
	assert.match(resetSource, /process\.env\.DATA_DIR/);
	assert.doesNotMatch(resetSource, /const dbPath = '\.\/data\/bills\.db'/);
	assert.match(resetSource, /verifyRequiredSchema/);

	const dataDirectory = mkdtempSync(join(tmpdir(), 'billtrack-reset-test-'));
	try {
		const result = spawnSync(
			process.execPath,
			['--import', 'tsx', join(process.cwd(), 'scripts', 'reset-db.ts')],
			{
				cwd: process.cwd(),
				env: { ...process.env, DATA_DIR: dataDirectory },
				encoding: 'utf8'
			}
		);
		assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
		const sqlite = new Database(join(dataDirectory, 'bills.db'), {
			readonly: true
		});
		try {
			verifyRequiredSchema(sqlite);
		} finally {
			sqlite.close();
		}
	} finally {
		rmSync(dataDirectory, { recursive: true, force: true });
	}
});
