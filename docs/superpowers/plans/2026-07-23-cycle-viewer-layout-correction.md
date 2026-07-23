# Cycle Viewer Layout Correction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the correct standalone Cycle Viewer while simplifying Payment History and eliminating Cycle Selector drag layout shift.

**Architecture:** Keep `selectedCycleId` as the single detail-page cycle selection. Render Cycle Viewer from that selection, keep Payment History chart-only, and render drag feedback as an absolute overlay within the timeline.

**Tech Stack:** Svelte 5, TypeScript, Tailwind CSS, Chart.js, Node test runner.

## Global Constraints

- Preserve existing top bill card buttons and colors.
- Add Payment remains in the top bill card.
- Do not calculate or predict cycles.
- Do not reassign existing payments when cycle boundaries change.

---

### Task 1: Lock the corrected layout with regression tests

**Files:**
- Modify: `src/lib/components/bill-ui-restoration.test.ts`

**Interfaces:**
- Consumes: Svelte component source files.
- Produces: Source-level regression assertions for the requested layout.

- [ ] Add assertions that BillCard has no empty status placeholder row.
- [ ] Add assertions that Cycle Selector drag feedback is absolutely positioned inside the timeline and Add Cycle contains a plus icon.
- [ ] Add assertions that detail has a standalone `Cycle Viewer` between selector and history.
- [ ] Add assertions that Payment History always renders `LineChart`, includes `No payment`, and has no `historyCycleSelect`.
- [ ] Run the focused test and confirm it fails for the missing behavior.

### Task 2: Correct Dashboard and Cycle Selector presentation

**Files:**
- Modify: `src/lib/components/BillCard.svelte`
- Modify: `src/lib/components/CycleSelector.svelte`

**Interfaces:**
- Consumes: `dragPreview`, `timeline`, and existing callbacks.
- Produces: Stable-height drag tooltip and neutral Add Cycle button.

- [ ] Remove the empty BillCard badge placeholder.
- [ ] Track the pointer's timeline percentage in `dragPreview`.
- [ ] Render an absolute tooltip at that percentage inside `data-cycle-timeline`.
- [ ] Replace the primary Add Cycle button with a neutral button containing a blue `Plus` icon.
- [ ] Run focused tests.

### Task 3: Restore standalone Cycle Viewer and simplify Payment History

**Files:**
- Modify: `src/routes/bills/[id]/+page.svelte`

**Interfaces:**
- Consumes: `selectedCycle`, `paymentsByCycle`, `historyChartPoints`.
- Produces: Standalone selected-cycle viewer and chart-only Payment History.

- [ ] Derive selected cycle payments, remaining amount, and payment percentage.
- [ ] Restore Cycle Viewer after Cycle Selector without an Add Payment button.
- [ ] Remove Payment History dropdown and cycle detail viewer.
- [ ] Always render the LineChart shell and overlay `No payment` when there are zero chart points.
- [ ] Run focused tests and Svelte checks.

### Task 4: Verify and commit

**Files:**
- Verify all modified files.

**Interfaces:**
- Consumes: Completed implementation.
- Produces: Verified commit.

- [ ] Run all Node tests.
- [ ] Run `svelte-check`.
- [ ] Run the production build.
- [ ] Verify Dashboard, tooltip positioning, Cycle Viewer, and empty Payment History in the browser.
- [ ] Request independent code review and fix Critical/Important findings.
- [ ] Commit only task-related files.
