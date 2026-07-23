# Manual Bill Cycles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace inferred bill cycles and due dates with explicitly created, contiguous cycles that users select, inspect, resize, and attach payments to.

**Architecture:** Persisted `bill_cycles` rows become the sole source of cycle truth. Read paths select the latest saved cycle only for presentation and never create data. A focused cycle domain utility owns placeholder and conflict rules, server mutations own transactional linked-boundary updates, and a reusable timeline selector owns the calendar interaction.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, TypeScript, Drizzle ORM, SQLite, date-fns, Vitest through Vite.

## Global Constraints

- Do not calculate a current or focus cycle.
- Do not generate cycles except after an explicit Add Cycle action.
- Do not use or display bill-level or cycle-level due dates.
- Frequency may only seed an editable placeholder.
- Saved normalized cycles must be contiguous and non-overlapping.
- Boundary edits may use only left and right handles and update the adjacent cycle atomically.
- Boundary edits never reassign payments and never warn about payment dates.
- Existing legacy gaps and overlaps remain readable and show a derived review message.
- The primary cycle action is always Add Payment.
- Preserve deprecated database columns during this safe rollout, but do not read them for business behavior.

---

### Task 1: Manual cycle domain rules

**Files:**
- Create: `src/lib/utils/manual-cycles.ts`
- Create: `src/lib/utils/manual-cycles.test.ts`
- Modify: `vite.config.ts`

**Interfaces:**
- Produces: `findCycleConflicts(cycles): CycleConflict[]`
- Produces: `getLatestCycle(cycles): cycle | null`
- Produces: `createCyclePlaceholder(params): { startDate: Date; endDate: Date }`
- Produces: `getLinkedBoundaryDates(params): { current; adjacent }`

- [ ] **Step 1: Write failing tests for ordering, conflict detection, placeholders, and linked boundaries**

```ts
it('detects a gap and an overlap without changing the input', () => {
  expect(findCycleConflicts(cycles)).toEqual([
    { type: 'gap', leftCycleId: 1, rightCycleId: 2 },
    { type: 'overlap', leftCycleId: 2, rightCycleId: 3 }
  ]);
});

it('uses frequency only to seed the cycle after the latest saved cycle', () => {
  expect(createCyclePlaceholder({
    cycles: [juneCycle],
    isRecurring: true,
    recurrenceInterval: 1,
    recurrenceUnit: 'month',
    today
  })).toEqual({ startDate: july1, endDate: july31 });
});

it('moves the next start when the selected end changes', () => {
  expect(getLinkedBoundaryDates({
    side: 'end',
    selected,
    adjacent: next,
    date: june30
  })).toEqual({
    current: { startDate: selected.startDate, endDate: june30 },
    adjacent: { startDate: july1, endDate: next.endDate }
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npx vitest run src/lib/utils/manual-cycles.test.ts`

Expected: FAIL because `manual-cycles.ts` does not exist.

- [ ] **Step 3: Implement pure calendar-day cycle rules**

Use `startOfDay`, `endOfDay`, `addDays`, `addWeeks`, `addMonths`, `addYears`,
`subDays`, and `compareAsc`. Never use `24 * 60 * 60 * 1000`.

- [ ] **Step 4: Run the focused tests**

Run: `npx vitest run src/lib/utils/manual-cycles.test.ts`

Expected: all manual-cycle tests pass.

### Task 2: Explicit cycle persistence and APIs

**Files:**
- Modify: `src/lib/server/db/bill-queries.ts`
- Modify: `src/routes/api/bills/[id]/cycles/+server.ts`
- Create: `src/routes/api/bills/[id]/cycles/[cycleId]/+server.ts`
- Create: `src/lib/server/db/manual-cycle-queries.test.ts`

**Interfaces:**
- Produces: `getLatestCycleForBill(billId)`
- Produces: `createManualCycle(billId, dates)`
- Produces: `updateManualCycleBoundary(billId, cycleId, side, date)`
- Produces: `deleteManualCycle(billId, cycleId)`
- `POST /api/bills/:id/cycles` accepts `{ startDate, endDate }`
- `PUT /api/bills/:id/cycles/:cycleId` accepts `{ side, date }`

- [ ] **Step 1: Add failing database tests proving reads never create cycles**

```ts
it('returns saved cycles without creating missing cycles', async () => {
  const before = countCycles(bill.id);
  await getCyclesForBill(bill.id);
  expect(countCycles(bill.id)).toBe(before);
});
```

Add tests for transactional left/right boundary updates, legacy conflict
preservation, bill ownership checks, and refusing deletion with linked payments.

- [ ] **Step 2: Run the focused database tests**

Run: `npx vitest run src/lib/server/db/manual-cycle-queries.test.ts`

Expected: FAIL on missing explicit manual-cycle mutations.

- [ ] **Step 3: Replace calculated reads with explicit saved-cycle queries**

Remove `ensureCyclesExist`, `getCurrentCycle`, `getFocusCycleForBill`,
`rebuildCurrentAndFutureCycles`, and payment-date cycle inference from live
query paths. `getBillWithCurrentCycle` becomes a compatibility-free
`getBillWithLatestCycle` returning `latestCycle`.

- [ ] **Step 4: Implement transactional create/update/delete mutations**

`updateManualCycleBoundary` must update the selected cycle and its sorted
neighbor in a single `db.transaction`. It rejects inverted ranges. Creation
allows unresolved legacy conflicts to remain elsewhere but requires the newly
saved boundary to be locally contiguous when existing cycles are present.

- [ ] **Step 5: Implement POST, PUT, and DELETE API handlers**

Normalize date-only input with the shared date helpers. Return `409` for
boundary conflicts or cycles with linked payments, `404` for ownership
mismatches, and the refreshed ordered cycle list after successful mutations.

- [ ] **Step 6: Run focused tests**

Run: `npx vitest run src/lib/server/db/manual-cycle-queries.test.ts`

Expected: all manual-cycle persistence tests pass.

### Task 3: Remove dates from bill creation and editing

**Files:**
- Modify: `src/lib/components/BillForm.svelte`
- Modify: `src/routes/api/bills/+server.ts`
- Modify: `src/routes/api/bills/[id]/+server.ts`
- Modify: `src/routes/bills/new/+page.server.ts`
- Modify: `src/lib/types/bill.ts`
- Modify: `src/lib/server/db/queries.ts`
- Modify: `src/lib/server/db/seed-bills.ts`

**Interfaces:**
- Bill form submits no `dueDate`, `cycleStartDate`, `cycleEndDate`, or
  `recurrenceDay`.
- Deprecated non-null bill date columns receive a compatibility timestamp only
  inside persistence and are never exposed as product inputs.

- [ ] **Step 1: Add or update tests for date-free bill payloads**

Assert that recurring and one-time bills can be created without any date field
and that no cycle is created as a side effect.

- [ ] **Step 2: Run tests and verify date requirements fail**

Run: `npx vitest run`

Expected: the new bill-creation assertions fail against current validation.

- [ ] **Step 3: Remove cycle and due-date controls from BillForm**

Keep the existing recurring frequency controls and display behavior. Remove
cycle rebuild scope controls because frequency edits do not rewrite cycles.

- [ ] **Step 4: Simplify create and update handlers**

Validate bill identity, amount, frequency, autopay, asset, and category fields
only. Do not call cycle rebuild functions. Isolate any legacy non-null database
date value in `createBill`, using creation time as an unused compatibility
value.

- [ ] **Step 5: Remove due-date filters and sorting from query types**

Bill filters become `all | paid | unpaid`; sort fields become
`amount | name | createdAt`. Remove date fields from `BillFormData`.

- [ ] **Step 6: Run type and focused tests**

Run: `npm run check`

Expected: no BillForm or API type errors.

### Task 4: Build the Cycle Selector and Cycle Viewer

**Files:**
- Create: `src/lib/components/CycleSelector.svelte`
- Create: `src/lib/components/cycle-selector-utils.ts`
- Create: `src/lib/components/cycle-selector-utils.test.ts`
- Modify: `src/routes/bills/[id]/+page.server.ts`
- Modify: `src/routes/bills/[id]/+page.svelte`

**Interfaces:**
- `CycleSelector` consumes `{ cycles, selectedCycleId, recurrence, onSelect,
  onAdd, onResize }`.
- `onResize` emits `{ cycleId, side: 'start' | 'end', date: string }`.
- The page server returns `bill`, ordered `cycles`, `payments`, and supporting
  form lists without any current/focus cycle.

- [ ] **Step 1: Test selector layout calculations**

Test the visible date range, month labels, day-index positioning, latest-cycle
default selection, and conflict-message derivation.

- [ ] **Step 2: Run focused selector tests**

Run: `npx vitest run src/lib/components/cycle-selector-utils.test.ts`

Expected: FAIL because the utility does not exist.

- [ ] **Step 3: Implement a horizontally scrollable calendar timeline**

Render month labels and day grid lines. Render every cycle as its own positioned
bar so legacy overlaps remain visible. Add pointer-controlled left and right
handles only. Also expose exact start/end date inputs for the selected cycle.

- [ ] **Step 4: Replace Current Cycle with Cycle Viewer**

Default to the latest saved cycle, support explicit selection, show paid amount
and linked payments, and make the primary action always **Add Payment**. Remove
due, overdue, current, focus, Mark Paid, and Mark Unpaid presentation.

- [ ] **Step 5: Connect Add Cycle and resize mutations**

Add Cycle asks the pure placeholder utility for initial dates, lets the user
adjust them, then POSTs explicitly. Resize PUTs one boundary and refreshes the
returned cycle list. Show the legacy review message only while derived
conflicts exist.

- [ ] **Step 6: Run focused tests and Svelte checking**

Run: `npx vitest run src/lib/components/cycle-selector-utils.test.ts`

Run: `npm run check`

Expected: tests pass and the detail page has no Svelte diagnostics.

### Task 5: Make payment selection explicit

**Files:**
- Modify: `src/lib/components/PaymentModal.svelte`
- Modify: `src/lib/components/payment-modal-utils.ts`
- Modify: `src/lib/components/payment-modal-utils.test.ts`
- Modify: `src/lib/server/db/bill-queries.ts`
- Modify: `src/routes/api/bills/[id]/+server.ts`
- Modify: `src/routes/api/bills/[id]/payments/+server.ts`
- Modify: `src/routes/api/payments/[id]/+server.ts`

**Interfaces:**
- Payment modal receives `selectedCycleId`.
- Payment creation requires a non-null cycle ID belonging to the bill.
- Payment editing may explicitly move the payment to another cycle.

- [ ] **Step 1: Rewrite payment selection tests**

Assert selection priority is existing payment cycle, then explicitly selected
viewer cycle, then latest saved cycle. Remove unpaid/current/date containment
selection behavior.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npx vitest run src/lib/components/payment-modal-utils.test.ts`

Expected: old focus/current selection behavior fails the new assertions.

- [ ] **Step 3: Simplify PaymentModal copy and selection**

Replace “marking as paid” copy with “record a payment”. Always show a required
cycle selector and disable submit when no cycles exist.

- [ ] **Step 4: Require and validate explicit cycle IDs server-side**

Remove all `findCycleForPaymentDate` and cycle-creation fallbacks. Recalculate
only aggregate totals for the explicitly selected cycle or cycles after a
payment create/edit/delete.

- [ ] **Step 5: Run focused tests**

Run: `npx vitest run src/lib/components/payment-modal-utils.test.ts`

Expected: all payment-selection tests pass.

### Task 6: Remove current/due behavior from dashboard and cards

**Files:**
- Modify: `src/routes/+page.server.ts`
- Modify: `src/routes/+page.svelte`
- Modify: `src/lib/components/BillCard.svelte`
- Modify: `src/lib/utils/bill-status.ts`
- Modify: `src/lib/components/StatusIndicator.svelte`
- Modify: `src/lib/components/StatusBadge.svelte`

**Interfaces:**
- Bill summaries may expose `latestCycle`, explicitly labeled as latest.
- Dashboard filters are `all | paid | unpaid`.
- Dashboard statistics do not include overdue counts.

- [ ] **Step 1: Add failing dashboard transformation tests**

Assert the dashboard uses only saved latest-cycle aggregates and never produces
overdue/upcoming state.

- [ ] **Step 2: Run dashboard tests**

Run: `npx vitest run src/routes/activity/activity-page.test.ts`

Expected: updated assertions fail against due/current behavior.

- [ ] **Step 3: Replace current/focus/due presentation**

Cards show latest saved cycle dates and aggregate payment progress, explicitly
labeled Latest Cycle. Bills without cycles show Add Cycle guidance. Remove
overdue filters, indicators, and sorting.

- [ ] **Step 4: Run checking**

Run: `npm run check`

Expected: no remaining current/focus/due references in active components.

### Task 7: Remove obsolete calculation code and verify the migration

**Files:**
- Delete: `src/lib/server/utils/bill-cycle-calculator.ts`
- Modify: `src/lib/server/db/index.ts`
- Modify: `src/routes/settings/+page.server.ts`
- Modify: `src/routes/api/export/+server.ts`
- Modify: `drizzle/migrations/0000_initial.sql`

**Interfaces:**
- Existing databases retain legacy columns safely.
- New schemas no longer require product due-date input.
- Import/export preserves cycles and payment links without recalculating them.

- [ ] **Step 1: Search for prohibited behavior**

Run:

```bash
rg -n "calculateBillCycleDates|findCycleForPaymentDate|generateBillCyclesBetween|ensureCyclesExist|getCurrentCycle|getFocusCycleForBill|rebuildCurrentAndFutureCycles|focusCycle|currentCycle|dueDate" src
```

Expected: only intentional deprecated migration/import compatibility references
remain.

- [ ] **Step 2: Remove obsolete calculator and migration-time backfills**

Do not rewrite existing cycle boundaries or payment assignments. Initial-schema
changes apply only to fresh databases; compatibility migration keeps old
columns readable during rollout.

- [ ] **Step 3: Run the complete verification suite**

Run: `npx vitest run`

Run: `npm run check`

Run: `npm run build`

Expected: all tests pass, Svelte check reports zero errors, and production build
completes.

- [ ] **Step 4: Inspect the final diff**

Run: `git diff --check`

Run: `git status --short`

Expected: no whitespace errors and only intentional implementation files are
modified.
