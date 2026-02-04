import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { existsSync, unlinkSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import * as schema from '../src/lib/server/db/schema';

const dbPath = './data/bills.db';

console.log('🗑️  Resetting database...\n');

// Remove existing database if it exists
if (existsSync(dbPath)) {
	unlinkSync(dbPath);
	console.log('✓ Removed existing database');
}

// Remove WAL files if they exist
if (existsSync(`${dbPath}-wal`)) {
	unlinkSync(`${dbPath}-wal`);
	console.log('✓ Removed WAL file');
}

if (existsSync(`${dbPath}-shm`)) {
	unlinkSync(`${dbPath}-shm`);
	console.log('✓ Removed SHM file');
}

// Ensure data directory exists
const dataDir = dirname(dbPath);
if (!existsSync(dataDir)) {
	mkdirSync(dataDir, { recursive: true });
	console.log('✓ Created data directory');
}

// Create fresh database
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create schema via Drizzle migrations for consistency
const drizzleDb = drizzle(db, { schema });
const migrationsFolder = join(process.cwd(), 'drizzle', 'migrations');
migrate(drizzleDb, { migrationsFolder });
console.log('✓ Created database schema via migrations');

db.close();

console.log('\n✅ Database reset complete!\n');
