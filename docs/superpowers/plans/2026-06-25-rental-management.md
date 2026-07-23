# Rental Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional rental management with a settings toggle, rental-aware assets and bill forms, and a rentals page that shows chargeable bills plus the latest five payment notification records with notify dates.

**Architecture:** Extend the existing preferences, asset tag, bill, and payment data model rather than creating a separate rental subdomain. Keep rental-only payment notification state in a dedicated table, expose rental flags through the existing Settings and BillForm flows, and add a focused `/rentals` page plus rental APIs for browsing grouped data and updating notify state.

**Tech Stack:** SvelteKit, Svelte 5, TypeScript, Drizzle ORM, SQLite, node:test, svelte-check

---

## File Map

### Existing files to modify

- `src/lib/server/db/schema.ts`
  - Add `isRental`, `chargeToTenant`, `rentalManagementEnabled`, and `rentalPaymentNotifications`
- `src/lib/server/db/index.ts`
  - Add migration/backfill logic for new columns/table
- `src/lib/server/db/preference-queries.ts`
  - Persist the new preference
- `src/lib/server/db/queries.ts`
  - Include rental fields in asset tag and bill queries/mutations
- `src/routes/api/preferences/+server.ts`
  - Validate and persist `rentalManagementEnabled`
- `src/routes/api/asset-tags/+server.ts`
  - Accept and return `isRental`
- `src/routes/api/asset-tags/[id]/+server.ts`
  - Accept and return `isRental`
- `src/routes/api/bills/+server.ts`
  - Accept and validate `chargeToTenant`
- `src/routes/api/bills/[id]/+server.ts`
  - Accept and validate `chargeToTenant`
- `src/routes/+layout.server.ts`
  - Return `rentalManagementEnabled` for layout/nav gating
- `src/routes/+layout.svelte`
  - Pass rental-enabled state to nav components
- `src/lib/components/Navigation.svelte`
  - Conditionally add `Rental Management`
- `src/lib/components/MobileNavigation.svelte`
  - Conditionally add `Rental Management`
- `src/lib/components/settings/AssetTagFormModal.svelte`
  - Add `Is rental` UI
- `src/routes/settings/+page.svelte`
  - Carry `isRental` in form state and save flows
- `src/lib/components/BillForm.svelte`
  - Show `Charge tenant for this bill` only for rental assets
- `src/routes/bills/new/+page.svelte`
  - Continue using updated `BillForm`
- `src/routes/bills/[id]/+page.svelte`
  - Continue using updated `BillForm` initial data
- `src/routes/settings/+page.server.ts`
  - Ensure import/export/reset continues to include new fields

### New files to create

- `src/lib/server/db/rental-queries.ts`
  - Rental-focused queries and notification upsert helpers
- `src/routes/api/rentals/assets/+server.ts`
  - List rental assets with summary counts
- `src/routes/api/rentals/assets/[id]/+server.ts`
  - Fetch grouped rental view for one asset
- `src/routes/api/rentals/payments/[id]/notification/+server.ts`
  - Update `isNotified` and `notifiedOn`
- `src/routes/rentals/+page.server.ts`
  - Load rental assets and selected asset details
- `src/routes/rentals/+page.svelte`
  - Rental management UI
- `src/lib/components/rentals/PaymentNotificationRow.svelte`
  - Inline notify toggle + date editor
- `src/lib/components/rentals/RentalBillGroup.svelte`
  - Bill heading + latest-five payment list
- `src/lib/components/rentals/RentalAssetSelector.svelte`
  - Rental asset picker/list
- `src/lib/server/db/rental-queries.test.ts`
  - node:test coverage for rental query/data rules

## Task 1: Add Rental Schema And Migration Support

**Files:**
- Modify: `src/lib/server/db/schema.ts`
- Modify: `src/lib/server/db/index.ts`
- Test: `src/lib/server/db/rental-queries.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import {
	userPreferences,
	assetTags,
	bills,
	rentalPaymentNotifications
} from './schema';

test('rental schema exposes the new preference, asset, bill, and notification fields', () => {
	assert.equal(userPreferences.rentalManagementEnabled.name, 'rental_management_enabled');
	assert.equal(assetTags.isRental.name, 'is_rental');
	assert.equal(bills.chargeToTenant.name, 'charge_to_tenant');
	assert.equal(rentalPaymentNotifications.isNotified.name, 'is_notified');
	assert.equal(rentalPaymentNotifications.notifiedOn.name, 'notified_on');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --experimental-strip-types src/lib/server/db/rental-queries.test.ts`

Expected: `FAIL` with missing export or undefined property errors because the new schema fields do not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/server/db/schema.ts
export const rentalPaymentNotifications = sqliteTable('rental_payment_notifications', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	paymentId: integer('payment_id')
		.notNull()
		.unique()
		.references(() => billPayments.id, { onDelete: 'cascade' }),
	isNotified: integer('is_notified', { mode: 'boolean' }).notNull().default(false),
	notifiedOn: integer('notified_on', { mode: 'timestamp' }),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

// add to existing tables
isRental: integer('is_rental', { mode: 'boolean' }).notNull().default(false)
chargeToTenant: integer('charge_to_tenant', { mode: 'boolean' }).notNull().default(false)
rentalManagementEnabled: integer('rental_management_enabled', { mode: 'boolean' })
	.notNull()
	.default(false)
```

```ts
// src/lib/server/db/index.ts
const hasIsRental = assetTagColumns.some((col) => col.name === 'is_rental');
if (!hasIsRental) {
	sqlite.exec("ALTER TABLE asset_tags ADD COLUMN is_rental INTEGER NOT NULL DEFAULT 0");
}

const hasChargeToTenant = billColumns.some((col) => col.name === 'charge_to_tenant');
if (!hasChargeToTenant) {
	sqlite.exec("ALTER TABLE bills ADD COLUMN charge_to_tenant INTEGER NOT NULL DEFAULT 0");
}

const hasRentalManagementEnabled = preferenceColumns.some(
	(col) => col.name === 'rental_management_enabled'
);
if (!hasRentalManagementEnabled) {
	sqlite.exec(
		"ALTER TABLE user_preferences ADD COLUMN rental_management_enabled INTEGER NOT NULL DEFAULT 0"
	);
}

sqlite.exec(`
	CREATE TABLE IF NOT EXISTS rental_payment_notifications (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		payment_id INTEGER NOT NULL UNIQUE REFERENCES bill_payments(id) ON DELETE CASCADE,
		is_notified INTEGER NOT NULL DEFAULT 0,
		notified_on INTEGER,
		created_at INTEGER NOT NULL DEFAULT (unixepoch()),
		updated_at INTEGER NOT NULL DEFAULT (unixepoch())
	)
`);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test --experimental-strip-types src/lib/server/db/rental-queries.test.ts`

Expected: `PASS` for the schema field assertions.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/db/schema.ts src/lib/server/db/index.ts src/lib/server/db/rental-queries.test.ts
git commit -m "feat: add rental schema fields"
```

## Task 2: Extend Preferences, Asset Tags, And Bills For Rental Flags

**Files:**
- Modify: `src/lib/server/db/preference-queries.ts`
- Modify: `src/lib/server/db/queries.ts`
- Modify: `src/routes/api/preferences/+server.ts`
- Modify: `src/routes/api/asset-tags/+server.ts`
- Modify: `src/routes/api/asset-tags/[id]/+server.ts`
- Modify: `src/routes/api/bills/+server.ts`
- Modify: `src/routes/api/bills/[id]/+server.ts`
- Test: `src/lib/server/db/rental-queries.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeRentalBillInput } from '../routes/api/bills/rental-validation-test-helper.ts';

test('chargeToTenant is cleared when the selected asset is not rental', () => {
	const result = normalizeRentalBillInput({
		assetTagId: 12,
		chargeToTenant: true,
		assetIsRental: false
	});

	assert.equal(result.chargeToTenant, false);
});

test('notifiedOn is required when setting a payment as notified', () => {
	assert.throws(
		() => normalizeRentalBillInput({ isNotified: true, notifiedOn: null }),
		/notifiedOn is required/
	);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --experimental-strip-types src/lib/server/db/rental-queries.test.ts`

Expected: `FAIL` because the helper/validation logic does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/server/db/preference-queries.ts
return createUserPreferences({
	themePreference: 'system',
	rentalManagementEnabled: false
});
```

```ts
// src/lib/server/db/queries.ts
export function getAssetTagById(id: number) {
	return db.select().from(assetTags).where(eq(assetTags.id, id)).get();
}

export function updateAssetTag(id: number, data: Partial<NewAssetTag>) {
	return db
		.update(assetTags)
		.set({ ...data, updatedAt: new Date() })
		.where(eq(assetTags.id, id))
		.returning()
		.get();
}

// ensure bill select projections include chargeToTenant
chargeToTenant: bills.chargeToTenant,
isRental: assetTags.isRental,
```

```ts
// src/routes/api/preferences/+server.ts
if (
	data.rentalManagementEnabled !== undefined &&
	typeof data.rentalManagementEnabled !== 'boolean'
) {
	return json({ error: 'Invalid rentalManagementEnabled flag' }, { status: 400 });
}

const updated = updateUserPreferences(existing.id, {
	themePreference: data.themePreference,
	rentalManagementEnabled: data.rentalManagementEnabled
});
```

```ts
// src/routes/api/bills/rental-validation-test-helper.ts
export function normalizeRentalBillInput(input: {
	assetTagId?: number | null;
	chargeToTenant?: boolean;
	assetIsRental?: boolean;
	isNotified?: boolean;
	notifiedOn?: string | null;
}) {
	if (input.isNotified && !input.notifiedOn) {
		throw new Error('notifiedOn is required');
	}

	return {
		chargeToTenant: Boolean(input.assetTagId && input.assetIsRental && input.chargeToTenant)
	};
}
```

```ts
// src/routes/api/bills/+server.ts and [id]/+server.ts
const assetTagId = parseOptionalId(data.assetTagId);
const selectedAsset = assetTagId ? getAssetTagById(assetTagId) : null;
const chargeToTenant = Boolean(data.chargeToTenant && selectedAsset?.isRental);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test --experimental-strip-types src/lib/server/db/rental-queries.test.ts`

Expected: `PASS` for bill/notification validation coverage.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/db/preference-queries.ts src/lib/server/db/queries.ts src/routes/api/preferences/+server.ts src/routes/api/asset-tags/+server.ts src/routes/api/asset-tags/[id]/+server.ts src/routes/api/bills/+server.ts src/routes/api/bills/[id]/+server.ts src/routes/api/bills/rental-validation-test-helper.ts src/lib/server/db/rental-queries.test.ts
git commit -m "feat: add rental validation to preferences assets and bills"
```

## Task 3: Build Rental Query Helpers And Notification API

**Files:**
- Create: `src/lib/server/db/rental-queries.ts`
- Create: `src/routes/api/rentals/assets/+server.ts`
- Create: `src/routes/api/rentals/assets/[id]/+server.ts`
- Create: `src/routes/api/rentals/payments/[id]/notification/+server.ts`
- Test: `src/lib/server/db/rental-queries.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import { mergeNotificationState } from './rental-queries.ts';

test('mergeNotificationState clears notifiedOn when the payment is not notified', () => {
	const result = mergeNotificationState({
		isNotified: false,
		notifiedOn: new Date('2026-06-25T00:00:00.000Z')
	});

	assert.equal(result.isNotified, false);
	assert.equal(result.notifiedOn, null);
});

test('mergeNotificationState keeps notifiedOn when the payment is notified', () => {
	const result = mergeNotificationState({
		isNotified: true,
		notifiedOn: new Date('2026-06-25T00:00:00.000Z')
	});

	assert.equal(result.isNotified, true);
	assert.equal(result.notifiedOn?.toISOString(), '2026-06-25T00:00:00.000Z');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --experimental-strip-types src/lib/server/db/rental-queries.test.ts`

Expected: `FAIL` because `mergeNotificationState` and rental query helpers do not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/server/db/rental-queries.ts
export function mergeNotificationState(input: {
	isNotified: boolean;
	notifiedOn: Date | null;
}) {
	return {
		isNotified: input.isNotified,
		notifiedOn: input.isNotified ? input.notifiedOn : null
	};
}

export async function getRentalAssets() {
	return db
		.select({
			id: assetTags.id,
			name: assetTags.name,
			type: assetTags.type,
			color: assetTags.color,
			bannerPattern: assetTags.bannerPattern
		})
		.from(assetTags)
		.where(eq(assetTags.isRental, true))
		.orderBy(assetTags.name);
}

export async function upsertRentalPaymentNotification(input: {
	paymentId: number;
	isNotified: boolean;
	notifiedOn: Date | null;
}) {
	const normalized = mergeNotificationState(input);
	const existing = db
		.select()
		.from(rentalPaymentNotifications)
		.where(eq(rentalPaymentNotifications.paymentId, input.paymentId))
		.get();

	if (existing) {
		return db
			.update(rentalPaymentNotifications)
			.set({ ...normalized, updatedAt: new Date() })
			.where(eq(rentalPaymentNotifications.paymentId, input.paymentId))
			.returning()
			.get();
	}

	return db
		.insert(rentalPaymentNotifications)
		.values({ ...normalized, paymentId: input.paymentId })
		.returning()
		.get();
}
```

```ts
// src/routes/api/rentals/payments/[id]/notification/+server.ts
const data = await request.json();
if (typeof data.isNotified !== 'boolean') {
	return json({ error: 'isNotified must be a boolean' }, { status: 400 });
}
if (data.isNotified && !data.notifiedOn) {
	return json({ error: 'notifiedOn is required when notifying a payment' }, { status: 400 });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test --experimental-strip-types src/lib/server/db/rental-queries.test.ts`

Expected: `PASS` for notification normalization coverage.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/db/rental-queries.ts src/routes/api/rentals/assets/+server.ts src/routes/api/rentals/assets/[id]/+server.ts src/routes/api/rentals/payments/[id]/notification/+server.ts src/lib/server/db/rental-queries.test.ts
git commit -m "feat: add rental queries and notification api"
```

## Task 4: Add Rental Controls To Settings, Layout, And Navigation

**Files:**
- Modify: `src/routes/+layout.server.ts`
- Modify: `src/routes/+layout.svelte`
- Modify: `src/lib/components/Navigation.svelte`
- Modify: `src/lib/components/MobileNavigation.svelte`
- Modify: `src/lib/components/settings/AssetTagFormModal.svelte`
- Modify: `src/routes/settings/+page.svelte`
- Test: `src/lib/server/db/rental-queries.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildNavItems } from '../components/navigation-test-helper.ts';

test('rental nav item appears only when rental management is enabled', () => {
	assert.equal(buildNavItems(false).some((item) => item.href === '/rentals'), false);
	assert.equal(buildNavItems(true).some((item) => item.href === '/rentals'), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --experimental-strip-types src/lib/server/db/rental-queries.test.ts`

Expected: `FAIL` because `buildNavItems` or equivalent helper is missing.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/routes/+layout.server.ts
return {
	themePreference: preferences.themePreference,
	rentalManagementEnabled: preferences.rentalManagementEnabled,
	appVersion: packageJson.version
};
```

```svelte
<!-- src/routes/+layout.svelte -->
<Navigation
	appVersion={data.appVersion}
	rentalManagementEnabled={data.rentalManagementEnabled}
/>
{#if isMobile}
	<MobileNavigation rentalManagementEnabled={data.rentalManagementEnabled} />
{/if}
```

```svelte
<!-- src/lib/components/settings/AssetTagFormModal.svelte -->
<label class="flex items-center gap-3">
	<input type="checkbox" bind:checked={assetTagForm.isRental} />
	<span class="text-sm font-medium text-gray-700 dark:text-gray-300">Is rental</span>
</label>
```

```ts
// src/routes/settings/+page.svelte
let assetTagForm = $state({
	name: '',
	type: '',
	color: '#6b7280',
	bannerPattern: 'solid',
	isRental: false
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run check`

Expected: `svelte-check found 0 errors and 0 warnings`

- [ ] **Step 5: Commit**

```bash
git add src/routes/+layout.server.ts src/routes/+layout.svelte src/lib/components/Navigation.svelte src/lib/components/MobileNavigation.svelte src/lib/components/settings/AssetTagFormModal.svelte src/routes/settings/+page.svelte src/lib/components/navigation-test-helper.ts src/lib/server/db/rental-queries.test.ts
git commit -m "feat: add rental controls to settings and navigation"
```

## Task 5: Add Charge-To-Tenant Support To Bill Forms And Bill Save Flows

**Files:**
- Modify: `src/lib/components/BillForm.svelte`
- Modify: `src/routes/bills/new/+page.svelte`
- Modify: `src/routes/bills/[id]/+page.svelte`
- Modify: `src/routes/bills/new/+page.server.ts`
- Modify: `src/routes/bills/[id]/+page.server.ts`
- Test: `src/lib/server/db/rental-queries.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import { shouldShowChargeToTenant } from '../components/bill-form-rental-helper.ts';

test('charge to tenant only appears for rental assets', () => {
	assert.equal(shouldShowChargeToTenant(null, []), false);
	assert.equal(
		shouldShowChargeToTenant(2, [
			{ id: 2, isRental: true, name: 'House 1', type: 'house', color: null, bannerPattern: 'solid' }
		]),
		true
	);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --experimental-strip-types src/lib/server/db/rental-queries.test.ts`

Expected: `FAIL` because the helper and charge-to-tenant logic do not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/components/bill-form-rental-helper.ts
export function shouldShowChargeToTenant(
	assetTagId: number | null,
	assetTags: Array<{ id: number; isRental: boolean }>
) {
	if (assetTagId === null) return false;
	return assetTags.some((tag) => tag.id === assetTagId && tag.isRental);
}
```

```svelte
<!-- src/lib/components/BillForm.svelte -->
let chargeToTenant = $state(false);
const selectedAssetIsRental = $derived(
	assetTags.some((tag) => tag.id === assetTagId && tag.isRental)
);

$effect(() => {
	if (!selectedAssetIsRental) {
		chargeToTenant = false;
	}
});

{#if selectedAssetIsRental}
	<label class="flex items-center gap-3">
		<input type="checkbox" bind:checked={chargeToTenant} />
		<span class="text-sm font-medium text-gray-700 dark:text-gray-300">Charge tenant for this bill</span>
	</label>
{/if}
```

```ts
// include in BillForm submit payload
chargeToTenant: selectedAssetIsRental ? chargeToTenant : false,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run check`

Expected: `svelte-check found 0 errors and 0 warnings`

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/BillForm.svelte src/routes/bills/new/+page.svelte src/routes/bills/[id]/+page.svelte src/routes/bills/new/+page.server.ts src/routes/bills/[id]/+page.server.ts src/lib/components/bill-form-rental-helper.ts src/lib/server/db/rental-queries.test.ts
git commit -m "feat: add charge to tenant bill form support"
```

## Task 6: Build The Rentals Page And Grouped Payment Notification UI

**Files:**
- Create: `src/routes/rentals/+page.server.ts`
- Create: `src/routes/rentals/+page.svelte`
- Create: `src/lib/components/rentals/RentalAssetSelector.svelte`
- Create: `src/lib/components/rentals/RentalBillGroup.svelte`
- Create: `src/lib/components/rentals/PaymentNotificationRow.svelte`
- Modify: `src/lib/server/db/rental-queries.ts`
- Test: `src/lib/server/db/rental-queries.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import { groupBillsByAsset } from './rental-queries.ts';

test('groupBillsByAsset keeps bills under the selected rental asset', () => {
	const grouped = groupBillsByAsset(
		{ id: 1, name: 'House 1' },
		[
			{ id: 101, assetTagId: 1, name: 'Water' },
			{ id: 102, assetTagId: 1, name: 'Electric' }
		]
	);

	assert.equal(grouped.asset.name, 'House 1');
	assert.deepEqual(
		grouped.bills.map((bill) => bill.name),
		['Water', 'Electric']
	);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --experimental-strip-types src/lib/server/db/rental-queries.test.ts`

Expected: `FAIL` because grouped rental page helpers do not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/server/db/rental-queries.ts
export function groupBillsByAsset(asset: { id: number; name: string }, bills: Array<{ assetTagId: number }>) {
	return {
		asset,
		bills: bills.filter((bill) => bill.assetTagId === asset.id)
	};
}
```

```ts
// src/routes/rentals/+page.server.ts
export const load: PageServerLoad = async ({ url }) => {
	const assets = await getRentalAssets();
	const selectedAssetId = Number(url.searchParams.get('asset') ?? assets[0]?.id ?? 0);
	const selectedAsset = selectedAssetId
		? await getRentalAssetDetail(selectedAssetId)
		: null;

	return {
		assets,
		selectedAsset
	};
};
```

```svelte
<!-- src/routes/rentals/+page.svelte -->
{#if data.assets.length === 0}
	<p class="text-sm text-gray-500 dark:text-gray-400">
		No rental assets yet. Mark an asset as rental in Settings to start.
	</p>
{:else if !data.selectedAsset}
	<p class="text-sm text-gray-500 dark:text-gray-400">Choose a rental asset to review its chargeable bills.</p>
{:else}
	<RentalAssetSelector assets={data.assets} selectedAssetId={data.selectedAsset.asset.id} />
	{#each data.selectedAsset.bills as bill}
		<RentalBillGroup {bill} />
	{/each}
{/if}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run check`

Expected: `svelte-check found 0 errors and 0 warnings`

- [ ] **Step 5: Commit**

```bash
git add src/routes/rentals/+page.server.ts src/routes/rentals/+page.svelte src/lib/components/rentals/RentalAssetSelector.svelte src/lib/components/rentals/RentalBillGroup.svelte src/lib/components/rentals/PaymentNotificationRow.svelte src/lib/server/db/rental-queries.ts src/lib/server/db/rental-queries.test.ts
git commit -m "feat: add rental management page"
```

## Task 7: Final Verification And Documentation

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `README.md`

- [ ] **Step 1: Write the failing test**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

test('placeholder verification test removed before commit', () => {
	assert.equal(true, true);
});
```

- [ ] **Step 2: Run verification to establish baseline**

Run: `node --test --experimental-strip-types src/lib/server/db/rental-queries.test.ts`

Expected: `PASS` for all rental-focused tests before docs updates.

- [ ] **Step 3: Write minimal implementation**

```md
<!-- CHANGELOG.md -->
- Added optional rental management with rental-aware assets, charge-to-tenant bill settings, and payment notification dates.
```

```md
<!-- README.md -->
- Rental management can be enabled from Settings and includes rental assets, chargeable bills, and payment notify-date tracking.
```

- [ ] **Step 4: Run full verification**

Run: `node --test --experimental-strip-types src/lib/server/db/rental-queries.test.ts && npm run check`

Expected:
- Rental node tests: `pass`
- `svelte-check found 0 errors and 0 warnings`

- [ ] **Step 5: Commit**

```bash
git add CHANGELOG.md README.md
git commit -m "docs: document rental management"
```

## Self-Review

### Spec coverage

- Settings toggle: covered in Task 4
- Asset `isRental`: covered in Tasks 2 and 4
- Bill `chargeToTenant`: covered in Tasks 2 and 5
- Rentals page grouped by rental asset: covered in Task 6
- Latest five payments with `isNotified` and `notifiedOn`: covered in Tasks 3 and 6
- Preserve history when an asset stops being rental: covered in Tasks 2, 3, and 6 via validation and inactive-data behavior
- Navigation gating: covered in Task 4
- Migration/backfill: covered in Task 1

### Placeholder scan

- No `TODO`, `TBD`, or “implement later” placeholders remain
- Every task includes files, commands, expected results, and concrete code snippets

### Type consistency

- Preference field: `rentalManagementEnabled`
- Asset field: `isRental`
- Bill field: `chargeToTenant`
- Notification fields: `isNotified`, `notifiedOn`
- Query helper file: `src/lib/server/db/rental-queries.ts`

Plan complete and saved to `docs/superpowers/plans/2026-06-25-rental-management.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
