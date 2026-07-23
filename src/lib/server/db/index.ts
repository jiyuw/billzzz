import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { initializeSqliteDatabase } from './migrations';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { building } from '$app/environment';

const dataDirectory =
	process.env.DATA_DIR ||
	(process.env.NODE_ENV === 'production' ? '/app/data' : './data');
const dbPath = join(dataDirectory, 'bills.db');
const migrationsFolder = join(process.cwd(), 'drizzle', 'migrations');

let sqlite: Database.Database;
let isInitialized = false;

function initializeDatabase() {
	if (isInitialized || building) return;

	const directory = dirname(dbPath);
	if (!existsSync(directory)) {
		mkdirSync(directory, { recursive: true });
	}

	sqlite = new Database(dbPath);
	sqlite.pragma('journal_mode = WAL');
	sqlite.pragma('foreign_keys = ON');

	try {
		initializeSqliteDatabase(sqlite, migrationsFolder);
		isInitialized = true;
	} catch (error) {
		sqlite.close();
		throw error;
	}
}

function getDb() {
	if (!isInitialized && !building) {
		initializeDatabase();
	}
	return drizzle(sqlite, { schema });
}

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
	get(_target, property) {
		const dbInstance = getDb();
		return Reflect.get(dbInstance, property);
	}
});

export { sqlite };
