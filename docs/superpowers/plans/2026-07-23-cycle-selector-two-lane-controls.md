# Cycle Selector Two-Lane Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep cycle bars in two alternating lanes, add an icon-only cycle delete action, and distinguish selected from unselected cycles with stronger color contrast.

**Architecture:** Put deterministic lane assignment in the existing selector utility module and keep rendering in `CycleSelector.svelte`. Pass deletion through a new `onDelete(cycleId)` component callback so the bill detail page remains responsible for confirmation, API mutation, errors, and reloading data.

**Tech Stack:** Svelte 5, TypeScript, Tailwind CSS, Lucide Svelte, Node test runner.

## Global Constraints

- Saved cycles are sorted by decoded start date before lane assignment.
- Cycle bars use exactly two lanes regardless of cycle count.
- Existing drag, tooltip, scrolling, month header, grid, and resize-handle behavior remains unchanged.
- The delete control is a red icon-only `Trash2` button after both date inputs and asks for confirmation before deletion.
- Existing backend cycle deletion rules and errors remain authoritative.
- No surrounding bill-card, cycle-viewer, or payment-history UI changes are allowed.

---

### Task 1: Two-Lane Rendering, Selection Colors, and Deletion

**Files:**
- Modify: `src/lib/components/cycle-selector-utils.ts`
- Modify: `src/lib/components/cycle-selector-utils.test.ts`
- Modify: `src/lib/components/CycleSelector.svelte`
- Modify: `src/lib/components/bill-ui-restoration.test.ts`
- Modify: `src/routes/bills/[id]/+page.svelte`

**Interfaces:**
- Produces: `cycleLane(index: number): 0 | 1`
- Produces: `CycleSelector` prop `onDelete: (cycleId: number) => void | Promise<void>`
- Consumes: existing `DELETE /api/bills/:billId/cycles/:cycleId`

- [ ] **Step 1: Write failing tests**

Add utility assertions:

```ts
assert.deepEqual([0, 1, 2, 3, 4].map(cycleLane), [0, 1, 0, 1, 0]);
```

Add source assertions that the selector imports `Trash2`, uses a fixed-height two-lane container and `cycleLane(index)`, uses light-blue unselected classes and dark-blue selected classes, renders an icon-only accessible delete button, and that the detail page confirms before calling the existing cycle DELETE endpoint.

- [ ] **Step 2: Verify RED**

Run:

```bash
node --import tsx --test \
  src/lib/components/cycle-selector-utils.test.ts \
  src/lib/components/bill-ui-restoration.test.ts
```

Expected: FAIL because `cycleLane`, `onDelete`, fixed lanes, color classes, and deletion wiring do not exist.

- [ ] **Step 3: Implement the minimal behavior**

Add:

```ts
export function cycleLane(index: number): 0 | 1 {
	return Math.abs(Math.trunc(index)) % 2 === 0 ? 0 : 1;
}
```

Render sorted cycles inside one fixed-height relative container, position each bar with `top` derived from `cycleLane(index)`, change unselected styling to light blue and selected styling to dark blue, add the `Trash2` button after the two date inputs, and pass its selected cycle ID to `onDelete`.

In the detail page, confirm deletion, call the cycle DELETE endpoint, surface backend errors through `cycleError`, and call `invalidateAll()` after success.

- [ ] **Step 4: Verify focused tests**

Run the focused test command again.

Expected: all focused tests pass.

- [ ] **Step 5: Verify the application**

Run:

```bash
node --import tsx --test <all existing test files>
node node_modules/@sveltejs/kit/svelte-kit.js sync
node node_modules/svelte-check/bin/svelte-check --tsconfig ./tsconfig.json
node node_modules/vite/bin/vite.js build
git diff --check
```

Expected: all tests pass, type checking reports zero errors, the production build exits zero, and the diff has no whitespace errors.
