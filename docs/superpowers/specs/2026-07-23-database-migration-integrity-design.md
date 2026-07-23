# Database Migration Integrity

## Goal

Make database creation and upgrades deterministic for supported BillTrack databases while preserving every existing bill, cycle, payment, and rental payment notification.

## Supported upgrade paths

- A fresh database with no tables.
- A database created by the current `0000_initial` migration.
- A v1.4-or-newer database containing `bill_cycles`, `bill_payments`, and `user_preferences`.
- A v1.4-or-newer database whose `__drizzle_migrations` table is missing or empty.

Databases from versions before `bill_cycles` and `bill_payments` existed are not automatically upgraded. Their legacy `payment_history` rows do not contain enough information to assign them to cycles without prediction. Startup must reject that unsupported shape before making partial changes and provide a clear error.

## Canonical schema

The Drizzle migration files are the canonical schema. A fresh database created by the migrator must be usable immediately, without waiting for the first web request.

- `bill_payments.cycle_id` references `bill_cycles.id` with `ON DELETE NO ACTION`.
- `bill_payments.bill_id` continues to use `ON DELETE CASCADE`.
- `rental_payment_notifications.payment_id` continues to use `ON DELETE CASCADE` and remains unique.
- `activity_logs` is created by migrations.
- The removed bill-level cycle boundaries and cycle due date are not part of the Drizzle schema. Existing databases may retain those unused columns; they are not read, written, or destructively removed.
- `asset_tags.name` is not treated as database-unique because existing migrations and databases never enforced that constraint. This avoids failing upgrades or silently merging user data.

## Tracked database migration

Add a new migration after `0000_initial`.

SQLite cannot alter a foreign key in place, so the migration rebuilds `bill_payments`. It also rebuilds `rental_payment_notifications` in the same transaction so no child rows are lost while the parent table is replaced.

The migration copies IDs and all data fields exactly. It does not modify cycle dates, payment dates, payment ownership, totals, paid flags, or notes. After copying, it recreates the required unique index and runs with foreign-key enforcement intact.

## Missing migration metadata

Before running Drizzle migrations, initialization inspects the database shape.

- If no business tables exist, run all migrations normally.
- If supported business tables exist but migration metadata is missing or empty, run the same idempotent compatibility upgrade used by the incremental migration, then seed a migration baseline at the new migration timestamp. Future migrations can then run normally.
- If only an older unsupported schema exists, abort before any `ALTER TABLE`, table rebuild, or legacy-table deletion.

The compatibility upgrade is safe to run repeatedly. It rebuilds payment tables only when the cycle foreign key is not already `NO ACTION`.

## Runtime compatibility columns

The remaining legacy `ALTER TABLE` operations stay idempotent for v1.4 databases, but they run only after the database shape has passed the supported-version preflight.

The obsolete additions for `bills.cycle_start_date`, `bills.cycle_end_date`, and `bill_cycles.due_date` are removed. Existing copies of those columns are preserved but ignored.

## Reset behavior

`scripts/reset-db.ts` accepts `DATA_DIR`, creates the database entirely through Drizzle migrations, and verifies every required table, column, foreign key, and unique index. It must not depend on importing the web application or triggering a request.

The production `data/bills.db` path is never used by migration integration tests.

## Verification

Automated integration tests use temporary databases and cover:

1. Fresh migration.
2. Current tracked schema with bills, cycles, payments, and notifications.
3. Supported schema without migration metadata.
4. Unsupported pre-cycle schema, verifying that it fails before modifying data.
5. Re-running initialization to prove idempotency.

Every successful path checks:

- Row counts and primary keys are unchanged.
- Payment-to-cycle and notification-to-payment relationships are unchanged.
- `PRAGMA integrity_check` returns `ok`.
- `PRAGMA foreign_key_check` returns no rows.
- The cycle foreign key is `ON DELETE NO ACTION`.
- Deleting a cycle with a linked payment is rejected by SQLite.
- All required schema objects exist immediately after migration.

Existing conflicting, overlapping, gapped, or inverted cycle dates are reported but preserved for user review.
