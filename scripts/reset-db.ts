import Database from 'better-sqlite3';
import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
	initializeSqliteDatabase,
	verifyRequiredSchema
} from '../src/lib/server/db/migrations.ts';

const configuredDataDirectory = process.env.DATA_DIR?.trim();
const allowDefaultDataDirectory = process.argv.includes(
	'--allow-default-data-dir'
);

if (!configuredDataDirectory && !allowDefaultDataDirectory) {
	throw new Error(
		'Refusing to reset the default database without DATA_DIR. Set DATA_DIR to an explicit directory or pass --allow-default-data-dir.'
	);
}

const dataDirectory = resolve(configuredDataDirectory || './data');
const dbPath = join(dataDirectory, 'bills.db');
const migrationsFolder = join(process.cwd(), 'drizzle', 'migrations');

console.log(`Resetting database at ${dbPath}`);

for (const path of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
	if (existsSync(path)) {
		unlinkSync(path);
	}
}

if (!existsSync(dataDirectory)) {
	mkdirSync(dataDirectory, { recursive: true });
}

const sqlite = new Database(dbPath);
try {
	sqlite.pragma('journal_mode = WAL');
	sqlite.pragma('foreign_keys = ON');
	initializeSqliteDatabase(sqlite, migrationsFolder);
	verifyRequiredSchema(sqlite);
	console.log(
		'Database reset and full schema verification completed, including rental_payment_notifications'
	);
} finally {
	sqlite.close();
}
