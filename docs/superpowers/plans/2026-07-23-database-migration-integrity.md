# Database Migration Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make fresh creation and every supported BillTrack database upgrade deterministic, lossless, idempotent, and fully verified without touching the production database.

**Architecture:** Extract database initialization into a Svelte-independent migration module that preflights database shape before any write. Keep Drizzle SQL files canonical, add one tracked integrity migration for existing tracked databases, and use an idempotent TypeScript compatibility path only for supported databases with missing migration metadata.

**Tech Stack:** TypeScript, Node test runner, better-sqlite3, Drizzle ORM SQLite migrator, SvelteKit.

## Global Constraints

- Supported inputs are fresh databases, current `0000_initial` databases, v1.4+ databases containing `bill_cycles`, `bill_payments`, and `user_preferences`, and supported databases with missing or empty migration metadata.
- Pre-cycle databases must fail before any schema or data mutation.
- Existing bill, cycle, payment, and rental notification IDs and values must be preserved exactly.
- Existing invalid, overlapping, or gapped cycle dates must not be repaired automatically.
- `bill_payments.cycle_id` must use `ON DELETE NO ACTION`; linked-cycle deletion must fail at the SQLite layer.
- Tests and reset verification must use an explicit temporary `DATA_DIR`; they must never mutate `data/bills.db`.

---

### Task 1: Integration fixtures and preflight contract

**Files:**
- Create: `src/lib/server/db/migration-integrity.test.ts`
- Create: `src/lib/server/db/migrations.ts`

**Interfaces:**
- Produces: `initializeSqliteDatabase(sqlite, migrationsFolder): void`
- Produces: `class UnsupportedDatabaseError extends Error`

- [ ] **Step 1: Write failing tests**

Create temporary SQLite fixtures for: empty database, tracked `0000`, supported schema without metadata, and unsupported pre-cycle schema. Assert unsupported input throws `UnsupportedDatabaseError` and the `sqlite_master` schema plus all row data are byte-for-byte unchanged.

- [ ] **Step 2: Run the focused test**

Run: `node --import tsx --test src/lib/server/db/migration-integrity.test.ts`

Expected: FAIL because `migrations.ts` and its exports do not exist.

- [ ] **Step 3: Implement preflight and initializer boundary**

Implement table-name inspection, supported-shape classification, an early unsupported error, normal Drizzle migration for empty/tracked databases, and a separate missing-metadata branch. Do not add compatibility mutations until Task 3.

- [ ] **Step 4: Run focused tests**

Run: `node --import tsx --test src/lib/server/db/migration-integrity.test.ts`

Expected: unsupported-shape test passes; later migration assertions remain failing.

### Task 2: Canonical tracked migrations

**Files:**
- Modify: `drizzle/migrations/0000_initial.sql`
- Create: `drizzle/migrations/0001_payment_cycle_fk.sql`
- Modify: `drizzle/migrations/meta/_journal.json`
- Modify: `src/lib/server/db/migration-integrity.test.ts`

**Interfaces:**
- Consumes: Drizzle migrator from Task 1.
- Produces: a fresh canonical schema and tracked upgrade whose final timestamp is used by metadata recovery.

- [ ] **Step 1: Add failing fresh and tracked-upgrade assertions**

Assert required tables/columns/indexes exist immediately, obsolete cycle columns are absent on fresh databases, all fixture IDs and relationships survive upgrade, foreign-key checks are empty, and linked-cycle deletion fails.

- [ ] **Step 2: Verify RED**

Run: `node --import tsx --test src/lib/server/db/migration-integrity.test.ts`

Expected: FAIL because `activity_logs` is absent from canonical `0000` and current tracked copies retain `ON DELETE CASCADE`.

- [ ] **Step 3: Complete canonical SQL and add the tracked rebuild**

Add `activity_logs` to `0000_initial.sql`. In `0001_payment_cycle_fk.sql`, rebuild `bill_payments` and `rental_payment_notifications` in one migration, copy every column including IDs unchanged, drop child before parent, rename replacements, and recreate `rental_payment_notifications_payment_id_unique`.

- [ ] **Step 4: Verify GREEN**

Run: `node --import tsx --test src/lib/server/db/migration-integrity.test.ts`

Expected: fresh and tracked-upgrade tests pass with `integrity_check=ok` and no foreign-key violations.

### Task 3: Missing metadata and compatibility upgrades

**Files:**
- Modify: `src/lib/server/db/migrations.ts`
- Modify: `src/lib/server/db/migration-integrity.test.ts`

**Interfaces:**
- Consumes: final migration timestamp from `_journal.json`.
- Produces: idempotent compatibility column creation, conditional FK repair, and migration-baseline recovery.

- [ ] **Step 1: Add failing recovery and idempotency tests**

Test supported v1.4 fixtures with both missing and empty `__drizzle_migrations`. Assert legacy compatibility columns/tables are created, payment/notification data is unchanged, the baseline is seeded at the latest migration timestamp, and a second initializer run changes neither schema nor rows.

- [ ] **Step 2: Verify RED**

Run: `node --import tsx --test src/lib/server/db/migration-integrity.test.ts`

Expected: FAIL because missing metadata is not yet recovered.

- [ ] **Step 3: Implement the minimal compatibility transaction**

Add required legacy columns only when absent, create required support tables only when absent, backfill recurrence values, repair payment foreign keys only when not already `NO ACTION`, seed preset categories idempotently, and insert one latest-timestamp migration baseline after all work succeeds.

- [ ] **Step 4: Verify GREEN**

Run the focused test command twice.

Expected: all migration integration tests pass on both runs.

### Task 4: Wire runtime schema and application startup

**Files:**
- Modify: `src/lib/server/db/index.ts`
- Modify: `src/lib/server/db/schema.ts`
- Modify: `src/lib/server/db/queries.ts`
- Modify: `src/lib/server/db/bill-queries.ts`
- Modify: any compile-reported consumer of removed obsolete fields

**Interfaces:**
- Consumes: `initializeSqliteDatabase` from Task 1.
- Produces: runtime startup that has one migration path and Drizzle types matching the canonical schema.

- [ ] **Step 1: Add failing source assertions**

Assert runtime initialization delegates to `initializeSqliteDatabase` and schema/query code no longer declares, reads, or writes bill-level cycle boundaries or cycle due date.

- [ ] **Step 2: Verify RED**

Run: `node --import tsx --test src/lib/server/db/migration-integrity.test.ts src/lib/server/db/manual-cycle-queries.test.ts`

Expected: FAIL on existing inline migration logic and obsolete fields.

- [ ] **Step 3: Replace inline migration code and align schema**

Make `index.ts` open SQLite, set pragmas, call the initializer, and export Drizzle. Remove obsolete fields and the unsupported `asset_tags.name` unique declaration from `schema.ts`, then repair compile errors without changing bill/cycle/payment behavior.

- [ ] **Step 4: Verify GREEN**

Run: `npm run check`

Expected: zero Svelte/TypeScript errors.

### Task 5: Safe reset and end-to-end verification

**Files:**
- Modify: `scripts/reset-db.ts`
- Modify: `package.json`
- Modify: `src/lib/server/db/migration-integrity.test.ts`

**Interfaces:**
- Consumes: canonical Drizzle migrations and schema assertions.
- Produces: `npm run test:db-migrations` and a `DATA_DIR`-aware reset command.

- [ ] **Step 1: Add failing reset assertions**

Spawn `scripts/reset-db.ts` with a temporary `DATA_DIR`. Assert only that directory is removed/recreated and that the resulting database passes the same complete schema/FK/index verification as a fresh migration.

- [ ] **Step 2: Verify RED**

Run: `node --import tsx --test src/lib/server/db/migration-integrity.test.ts`

Expected: FAIL because reset still hardcodes `./data/bills.db`.

- [ ] **Step 3: Make reset explicit and complete**

Resolve `bills.db` from `DATA_DIR`, reject an absent/blank `DATA_DIR` unless `--allow-default-data-dir` is explicitly supplied, delete only the resolved database/WAL/SHM paths, migrate, and run complete integrity verification. Add `test:db-migrations`.

- [ ] **Step 4: Run full verification**

Run:

```bash
npm run test:db-migrations
npm run check
npm run build
```

Expected: all commands exit 0. Re-run migration tests against a copy of the current database in a temporary directory and compare all protected tables before and after.

- [ ] **Step 5: Review the final diff**

Run: `git diff --check` and `git status --short`.

Expected: no whitespace errors; the unrelated user-owned rental plan remains untouched.
