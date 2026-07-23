import type Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const REQUIRED_SUPPORTED_TABLES = [
	'bills',
	'bill_cycles',
	'bill_payments',
	'user_preferences'
] as const;

export class UnsupportedDatabaseError extends Error {
	constructor(missingTables: readonly string[]) {
		super(
			`Unsupported BillTrack database: automatic migration requires ${REQUIRED_SUPPORTED_TABLES.join(
				', '
			)}. Missing: ${missingTables.join(', ')}. Export or back up this database before upgrading it manually.`
		);
		this.name = 'UnsupportedDatabaseError';
	}
}

function tableNames(sqlite: Database.Database) {
	return new Set(
		(
			sqlite
				.prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
				.all() as Array<{ name: string }>
		).map((row) => row.name)
	);
}

function assertSupportedExistingShape(tables: Set<string>) {
	const businessTables = [...tables].filter(
		(name) => name !== '__drizzle_migrations' && !name.startsWith('sqlite_')
	);
	if (businessTables.length === 0) return;

	const missingTables = REQUIRED_SUPPORTED_TABLES.filter((name) => !tables.has(name));
	if (missingTables.length > 0) {
		throw new UnsupportedDatabaseError(missingTables);
	}
}

function migrationMetadataCount(sqlite: Database.Database, tables: Set<string>) {
	if (!tables.has('__drizzle_migrations')) return null;
	return (
		sqlite
			.prepare('SELECT COUNT(*) AS count FROM __drizzle_migrations')
			.get() as { count: number }
	).count;
}

function columnNames(sqlite: Database.Database, table: string) {
	return new Set(
		(
			sqlite.prepare(`PRAGMA table_info("${table}")`).all() as Array<{ name: string }>
		).map((column) => column.name)
	);
}

function addColumnWhenMissing(
	sqlite: Database.Database,
	table: string,
	column: string,
	definition: string
) {
	if (!columnNames(sqlite, table).has(column)) {
		sqlite.exec(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${definition}`);
	}
}

function createCompatibilityTables(sqlite: Database.Database) {
	sqlite.exec(`
		CREATE TABLE IF NOT EXISTS categories (
			id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
			name TEXT NOT NULL,
			color TEXT NOT NULL,
			icon TEXT,
			created_at INTEGER NOT NULL DEFAULT (unixepoch())
		);
		CREATE UNIQUE INDEX IF NOT EXISTS categories_name_unique ON categories(name);

		CREATE TABLE IF NOT EXISTS payment_methods (
			id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
			nickname TEXT NOT NULL,
			last_four TEXT NOT NULL,
			type TEXT,
			created_at INTEGER NOT NULL DEFAULT (unixepoch()),
			updated_at INTEGER NOT NULL DEFAULT (unixepoch())
		);

		CREATE TABLE IF NOT EXISTS asset_tags (
			id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
			name TEXT NOT NULL,
			type TEXT,
			is_rental INTEGER NOT NULL DEFAULT 0,
			color TEXT,
			banner_pattern TEXT NOT NULL DEFAULT 'solid',
			created_at INTEGER NOT NULL DEFAULT (unixepoch()),
			updated_at INTEGER NOT NULL DEFAULT (unixepoch())
		);

		CREATE TABLE IF NOT EXISTS activity_logs (
			id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
			level TEXT NOT NULL,
			event TEXT NOT NULL,
			log_type TEXT NOT NULL DEFAULT 'activity',
			request_id TEXT,
			method TEXT,
			path TEXT,
			route_id TEXT,
			entity_type TEXT,
			entity_id TEXT,
			details TEXT,
			created_at INTEGER NOT NULL DEFAULT (unixepoch())
		);

		CREATE TABLE IF NOT EXISTS rental_payment_notifications (
			id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
			payment_id INTEGER NOT NULL REFERENCES bill_payments(id) ON DELETE CASCADE,
			is_notified INTEGER NOT NULL DEFAULT 0,
			notified_on INTEGER,
			created_at INTEGER NOT NULL DEFAULT (unixepoch()),
			updated_at INTEGER NOT NULL DEFAULT (unixepoch())
		);
		CREATE UNIQUE INDEX IF NOT EXISTS rental_payment_notifications_payment_id_unique
			ON rental_payment_notifications(payment_id);
	`);
}

function addCompatibilityColumns(sqlite: Database.Database) {
	addColumnWhenMissing(sqlite, 'bills', 'is_autopay', 'INTEGER NOT NULL DEFAULT 0');
	addColumnWhenMissing(sqlite, 'bills', 'is_variable', 'INTEGER NOT NULL DEFAULT 0');
	addColumnWhenMissing(sqlite, 'bills', 'recurrence_interval', 'INTEGER');
	addColumnWhenMissing(sqlite, 'bills', 'recurrence_unit', 'TEXT');
	addColumnWhenMissing(sqlite, 'bills', 'payment_method_id', 'INTEGER');
	addColumnWhenMissing(sqlite, 'bills', 'asset_tag_id', 'INTEGER');
	addColumnWhenMissing(sqlite, 'bills', 'charge_to_tenant', 'INTEGER NOT NULL DEFAULT 0');

	addColumnWhenMissing(sqlite, 'payment_methods', 'type', 'TEXT');
	addColumnWhenMissing(sqlite, 'asset_tags', 'type', 'TEXT');
	addColumnWhenMissing(sqlite, 'asset_tags', 'is_rental', 'INTEGER NOT NULL DEFAULT 0');
	addColumnWhenMissing(sqlite, 'asset_tags', 'color', 'TEXT');
	addColumnWhenMissing(
		sqlite,
		'asset_tags',
		'banner_pattern',
		"TEXT NOT NULL DEFAULT 'solid'"
	);

	addColumnWhenMissing(sqlite, 'user_preferences', 'expected_income_amount', 'REAL');
	addColumnWhenMissing(sqlite, 'user_preferences', 'current_balance', 'REAL');
	addColumnWhenMissing(sqlite, 'user_preferences', 'last_balance_update', 'INTEGER');
	addColumnWhenMissing(
		sqlite,
		'user_preferences',
		'rental_management_enabled',
		'INTEGER NOT NULL DEFAULT 0'
	);
}

function backfillCompatibilityData(sqlite: Database.Database) {
	const recurrenceColumns = columnNames(sqlite, 'bills');
	if (
		recurrenceColumns.has('recurrence_type') &&
		recurrenceColumns.has('recurrence_unit') &&
		recurrenceColumns.has('recurrence_interval')
	) {
		sqlite.exec(`
			UPDATE bills
			SET recurrence_unit = CASE recurrence_type
				WHEN 'weekly' THEN 'week'
				WHEN 'biweekly' THEN 'week'
				WHEN 'monthly' THEN 'month'
				WHEN 'bimonthly' THEN 'month'
				WHEN 'quarterly' THEN 'month'
				WHEN 'yearly' THEN 'year'
				ELSE recurrence_unit
			END,
			recurrence_interval = CASE recurrence_type
				WHEN 'weekly' THEN 1
				WHEN 'biweekly' THEN 2
				WHEN 'monthly' THEN 1
				WHEN 'bimonthly' THEN 2
				WHEN 'quarterly' THEN 3
				WHEN 'yearly' THEN 1
				ELSE recurrence_interval
			END
			WHERE recurrence_unit IS NULL;
		`);
	}

	const insertCategory = sqlite.prepare(`
		INSERT INTO categories (name, color, icon, created_at)
		SELECT ?, ?, ?, unixepoch()
		WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = ?)
	`);
	for (const category of [
		{ name: 'Utility', color: '#3b82f6', icon: 'utility' },
		{ name: 'Insurance', color: '#10b981', icon: 'insurance' },
		{ name: 'Mortgage', color: '#8b5cf6', icon: 'mortgage' },
		{ name: 'Fee', color: '#f59e0b', icon: 'fee' }
	]) {
		insertCategory.run(category.name, category.color, category.icon, category.name);
	}
}

function cycleForeignKeyDeleteAction(sqlite: Database.Database) {
	const foreignKey = (
		sqlite.prepare("PRAGMA foreign_key_list('bill_payments')").all() as Array<{
			from: string;
			on_delete: string;
		}>
	).find((row) => row.from === 'cycle_id');
	return foreignKey?.on_delete.toUpperCase();
}

function repairPaymentCycleForeignKey(sqlite: Database.Database) {
	if (cycleForeignKeyDeleteAction(sqlite) === 'NO ACTION') return;

	sqlite.exec(`
		CREATE TABLE __compat_bill_payments (
			id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
			bill_id INTEGER NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
			cycle_id INTEGER NOT NULL REFERENCES bill_cycles(id) ON DELETE NO ACTION,
			amount REAL NOT NULL,
			payment_date INTEGER NOT NULL,
			notes TEXT,
			created_at INTEGER NOT NULL DEFAULT (unixepoch()),
			updated_at INTEGER NOT NULL DEFAULT (unixepoch())
		);
		INSERT INTO __compat_bill_payments
			(id, bill_id, cycle_id, amount, payment_date, notes, created_at, updated_at)
		SELECT id, bill_id, cycle_id, amount, payment_date, notes, created_at, updated_at
		FROM bill_payments;

		CREATE TABLE __compat_rental_payment_notifications (
			id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
			payment_id INTEGER NOT NULL REFERENCES __compat_bill_payments(id) ON DELETE CASCADE,
			is_notified INTEGER NOT NULL DEFAULT 0,
			notified_on INTEGER,
			created_at INTEGER NOT NULL DEFAULT (unixepoch()),
			updated_at INTEGER NOT NULL DEFAULT (unixepoch())
		);
		INSERT INTO __compat_rental_payment_notifications
			(id, payment_id, is_notified, notified_on, created_at, updated_at)
		SELECT id, payment_id, is_notified, notified_on, created_at, updated_at
		FROM rental_payment_notifications;

		DROP TABLE rental_payment_notifications;
		DROP TABLE bill_payments;
		ALTER TABLE __compat_bill_payments RENAME TO bill_payments;
		ALTER TABLE __compat_rental_payment_notifications
			RENAME TO rental_payment_notifications;
		CREATE UNIQUE INDEX rental_payment_notifications_payment_id_unique
			ON rental_payment_notifications(payment_id);
	`);
}

function runCompatibilityUpgrade(sqlite: Database.Database) {
	sqlite.transaction(() => {
		createCompatibilityTables(sqlite);
		addCompatibilityColumns(sqlite);
		backfillCompatibilityData(sqlite);
		repairPaymentCycleForeignKey(sqlite);
	})();
}

function latestMigrationTimestamp(migrationsFolder: string) {
	const journal = JSON.parse(
		readFileSync(join(migrationsFolder, 'meta', '_journal.json'), 'utf8')
	) as { entries: Array<{ when: number }> };
	const timestamp = Math.max(...journal.entries.map((entry) => entry.when));
	if (!Number.isFinite(timestamp)) {
		throw new Error('Drizzle migration journal has no valid timestamps');
	}
	return timestamp;
}

function recoverMigrationMetadata(
	sqlite: Database.Database,
	migrationsFolder: string
) {
	sqlite.transaction(() => {
		runCompatibilityUpgrade(sqlite);
		sqlite.exec(`
			CREATE TABLE IF NOT EXISTS __drizzle_migrations (
				id SERIAL PRIMARY KEY,
				hash TEXT NOT NULL,
				created_at NUMERIC
			)
		`);
		sqlite.prepare('DELETE FROM __drizzle_migrations').run();
		sqlite
			.prepare(
				'INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)'
			)
			.run('recovered-supported-baseline', latestMigrationTimestamp(migrationsFolder));
	})();
}

export function initializeSqliteDatabase(
	sqlite: Database.Database,
	migrationsFolder: string
) {
	sqlite.pragma('foreign_keys = ON');
	const tables = tableNames(sqlite);
	assertSupportedExistingShape(tables);

	const metadataCount = migrationMetadataCount(sqlite, tables);
	if (metadataCount === null || metadataCount === 0) {
		const hasBusinessTables = [...tables].some(
			(name) => name !== '__drizzle_migrations' && !name.startsWith('sqlite_')
		);
		if (hasBusinessTables) {
			recoverMigrationMetadata(sqlite, migrationsFolder);
			return;
		}
	}

	migrate(drizzle(sqlite), { migrationsFolder });
	runCompatibilityUpgrade(sqlite);
}

export function verifyDatabaseIntegrity(sqlite: Database.Database) {
	const integrity = (
		sqlite.prepare('PRAGMA integrity_check').get() as { integrity_check: string }
	).integrity_check;
	const foreignKeyViolations = sqlite.prepare('PRAGMA foreign_key_check').all();
	return { integrity, foreignKeyViolations };
}

export function verifyRequiredSchema(sqlite: Database.Database) {
	const tables = tableNames(sqlite);
	for (const table of [
		'categories',
		'asset_tags',
		'payment_methods',
		'bills',
		'bill_cycles',
		'bill_payments',
		'rental_payment_notifications',
		'user_preferences',
		'activity_logs',
		'__drizzle_migrations'
	]) {
		if (!tables.has(table)) {
			throw new Error(`Database is missing required table: ${table}`);
		}
	}

	const requiredColumns: Record<string, readonly string[]> = {
		bills: [
			'is_autopay',
			'is_variable',
			'recurrence_interval',
			'recurrence_unit',
			'payment_method_id',
			'asset_tag_id',
			'charge_to_tenant'
		],
		asset_tags: ['type', 'is_rental', 'color', 'banner_pattern'],
		user_preferences: [
			'expected_income_amount',
			'current_balance',
			'last_balance_update',
			'rental_management_enabled'
		],
		bill_cycles: ['bill_id', 'start_date', 'end_date', 'expected_amount', 'total_paid'],
		bill_payments: ['bill_id', 'cycle_id', 'amount', 'payment_date'],
		rental_payment_notifications: ['payment_id', 'is_notified', 'notified_on']
	};
	for (const [table, required] of Object.entries(requiredColumns)) {
		const columns = columnNames(sqlite, table);
		for (const column of required) {
			if (!columns.has(column)) {
				throw new Error(`Database is missing required column: ${table}.${column}`);
			}
		}
	}

	if (cycleForeignKeyDeleteAction(sqlite) !== 'NO ACTION') {
		throw new Error('bill_payments.cycle_id must use ON DELETE NO ACTION');
	}

	const notificationIndex = sqlite
		.prepare(`
			SELECT 1
			FROM sqlite_master
			WHERE type = 'index'
				AND name = 'rental_payment_notifications_payment_id_unique'
				AND sql LIKE 'CREATE UNIQUE INDEX%'
		`)
		.get();
	if (!notificationIndex) {
		throw new Error(
			'Database is missing unique rental payment notification index'
		);
	}

	const verification = verifyDatabaseIntegrity(sqlite);
	if (verification.integrity !== 'ok') {
		throw new Error(`Database integrity check failed: ${verification.integrity}`);
	}
	if (verification.foreignKeyViolations.length > 0) {
		throw new Error(
			`Database foreign key check failed: ${JSON.stringify(
				verification.foreignKeyViolations
			)}`
		);
	}
}
