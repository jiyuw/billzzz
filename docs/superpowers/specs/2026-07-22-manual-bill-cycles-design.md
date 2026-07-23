# Manual Bill Cycles Design

**Date:** 2026-07-22

## Objective

Replace calculated and predicted bill cycles with cycles that users explicitly
create, save, inspect, and adjust.

The application must not infer a current cycle, predict future cycles, rebuild
cycles from a schedule, or assign payments to cycles based on dates. Persisted
`bill_cycles` rows are the only source of truth.

## Product Model

### Bills

A bill describes the account or obligation. Creating a bill no longer asks for:

- cycle start date;
- cycle end date;
- due date.

Recurring bills continue to store and display their frequency in the existing
form, such as `Every 1 month` or `Every 2 weeks`.

Frequency is not a schedule and does not cause background or read-time cycle
generation. It is used only to produce an editable placeholder when the user
explicitly chooses **Add Cycle**.

One-time bills use the same manual cycle workflow. They do not have a frequency.

### Cycles

A cycle is a persisted record with:

- an inclusive start date;
- an inclusive end date;
- cycle-level amount information where applicable;
- zero or more explicitly linked payments.

Due date is removed from the product model. Cycle end date must not be treated
as a replacement due date.

### Payments

Every payment is explicitly linked to a cycle by `cycleId`. Payment dates do not
determine cycle membership.

Changing a cycle boundary must not move its payments. The application must not
warn when a payment date is outside its linked cycle. Users can change a
payment's cycle in Payment History.

## Removed Concepts

The redesign removes these concepts and behaviors from the application:

- bill-level cycle start, cycle end, and due dates;
- cycle due dates;
- calculated current cycle;
- focus cycle;
- automatic generation of cycles up to today;
- prediction of future cycles;
- cycle rebuilding after frequency changes;
- payment-to-cycle inference from payment date;
- overdue, upcoming, and days-until-due behavior;
- due-date sorting and due-date-based dashboard statistics;
- Mark Paid and Mark Unpaid as the primary bill/cycle action.

Code paths must not retain hidden or fallback versions of these behaviors.

## Bill Detail Experience

### Cycle Selector

The bill detail page contains a calendar-style Cycle Selector showing every
persisted cycle for the bill as a colored horizontal bar.

- All cycle bars use the same bill color treatment.
- The selected cycle has a distinct selected treatment.
- Clicking a bar selects the cycle.
- Only the left and right boundary handles are draggable.
- The whole bar cannot be dragged.
- Exact start and end date inputs remain available for precision and
  accessibility.
- With no cycles, the selector shows an empty state and **Add Cycle**.

The page does not select a cycle based on today's date. By default it selects
the cycle with the greatest `endDate`; ties use the greatest cycle ID.

The selected cycle ID should be representable in the page URL so refresh and
navigation can preserve an explicit selection.

### Cycle Viewer

The former Current Cycle area becomes a Cycle Viewer. It shows the explicitly
selected cycle and contains:

- cycle start and end dates;
- expected amount where applicable;
- total paid amount;
- number of linked payments;
- the linked payment list with date, amount, and notes;
- an **Add Payment** action.

Switching the Cycle Selector selection switches the Cycle Viewer.

The primary action is always **Add Payment**, regardless of paid status. Adding
a payment defaults to the selected cycle but lets the user choose any saved
cycle. A cycle can have multiple payments.

Editing, deleting, or reassigning individual payments is the way to correct
payment totals. A Mark Unpaid toggle must not replace that transaction history.

Any Paid, Partial, or payment-summary presentation must be derived from payment
records and must never change the primary **Add Payment** action.

## Adding Cycles

Cycles are created only after an explicit **Add Cycle** action.

For a recurring bill, frequency provides the initial placeholder range:

- when cycles exist, the placeholder begins immediately after the latest cycle
  and uses the frequency to suggest its initial end;
- when no cycle exists, the placeholder is centered from a sensible date such
  as today and uses frequency only to suggest its initial length.

For a one-time bill with no existing cycle, the initial placeholder may default
to today through today.

The placeholder is editable before saving. Once saved, the cycle has no dynamic
relationship with frequency. Opening a page, adding a payment, changing the
date, or querying the dashboard must never generate another cycle.

Calendar-unit placeholder calculations must use calendar date operations rather
than fixed millisecond durations.

## Boundary Invariants

Cycle dates are inclusive. In a normalized bill, sorted adjacent cycles satisfy:

```text
next.startDate = previous.endDate + 1 calendar day
```

Therefore normalized cycles have neither overlaps nor gaps.

Boundary editing uses linked boundaries:

- changing a cycle's start changes the preceding cycle's end to one calendar
  day earlier;
- changing a cycle's end changes the following cycle's start to one calendar
  day later;
- the earliest cycle's start and latest cycle's end are free outer boundaries;
- an edit that would produce `startDate > endDate` for any affected cycle is
  rejected.

The selected cycle and affected neighbors must be saved in one database
transaction. Local calendar-day functions must be used so daylight-saving
changes do not produce off-by-one errors.

The interface must not permit arbitrary whole-bar movement because that would
resize both neighboring cycles in a hard-to-predict way.

## Legacy Cycle Review

Migration preserves every existing cycle and every payment-to-cycle link. It
does not recalculate, normalize, delete, or reorder historical data.

Existing due dates stop participating in application behavior. All automatic
cycle generation and rebuilding must be disabled as part of the migration.

Legacy data is temporarily allowed to contain gaps or overlaps. Opening a bill
detail page does not force a review flow and does not block normal viewing.

The Cycle Selector dynamically checks sorted adjacent cycles:

```text
next.startDate <= previous.endDate
    => overlap

next.startDate > previous.endDate + 1 calendar day
    => gap
```

When any conflict exists, the selector shows a concise review message. The user
can resolve the data incrementally using linked boundary handles or exact date
inputs. The application recomputes conflicts after every save and removes the
message automatically when all adjacent cycles are contiguous.

This state is derived from cycle dates. It does not require a persistent
`cyclesNeedReview` flag or a Finish Review action.

While legacy conflicts remain:

- users can inspect cycles and payments normally;
- a boundary save may resolve one adjacent pair while other conflicts remain;
- the review message remains until all conflicts are resolved;
- the system never performs an automatic normalization.

Newly created cycles and bills whose cycles are already normalized must obey the
boundary invariants.

## Dashboard and Status Consequences

No dashboard or API may calculate a current or focus cycle.

Where a bill summary needs a representative cycle, it may use an explicitly
defined presentation rule such as the saved cycle with the greatest end date.
This is a display selection, not a claim that the cycle is current.

Removing due dates also removes:

- upcoming bill calculations;
- overdue calculations;
- days-until-due labels;
- due-date sorting;
- due-date reminder behavior.

Dashboard copy and statistics must be revised so they do not imply that cycle
end is a payment deadline.

## Data and API Direction

The target model makes bill-level and cycle-level due-date fields obsolete.
Migration may retain deprecated columns temporarily for safe rollout, but
application code must not read them for business behavior.

Cycle endpoints need explicit operations for:

- listing saved cycles;
- creating a placeholder and saving the adjusted cycle;
- selecting and reading one cycle with linked payments;
- updating a boundary and its neighbor transactionally;
- detecting legacy gaps and overlaps;
- deleting a cycle subject to payment-integrity rules.

Deleting a cycle with linked payments must not silently delete or reassign those
payments. The user must first delete or reassign them.

Payment creation and editing must require an explicit saved cycle selection.

## Error Handling

The server is responsible for enforcing:

- valid date input;
- `startDate <= endDate`;
- linked-boundary atomicity;
- no new overlap or gap outside the explicitly supported legacy-review state;
- bill ownership of every selected cycle;
- protection against deleting cycles with linked payments.

The client may preview boundary changes, but server validation is authoritative.
Failed saves leave all affected cycles unchanged.

## Testing Requirements

Tests must cover:

1. Creating recurring and one-time bills without cycle or due dates.
2. Opening a bill does not create, rebuild, or predict cycles.
3. Explicit Add Cycle placeholder behavior for recurring and one-time bills.
4. Default Cycle Viewer selection uses greatest end date, not today's date.
5. Left-handle editing updates the previous cycle atomically.
6. Right-handle editing updates the next cycle atomically.
7. Invalid linked-boundary edits roll back all affected changes.
8. Legacy gaps and overlaps are detected without mutating data.
9. The review message disappears after the final conflict is resolved.
10. Boundary edits preserve every payment's `cycleId`.
11. Payments outside cycle dates produce no warning or automatic reassignment.
12. Add Payment remains available for cycles with existing payments.
13. Multiple payments link to one cycle and aggregate correctly.
14. Payment editing can move a payment to another explicitly selected cycle.
15. No API, dashboard, or detail read path invokes old cycle calculation.
16. Due-date-based status, sorting, and reminder behavior is absent.
17. Calendar-day adjacency remains correct across daylight-saving transitions.

## Rollout

The rollout should:

1. introduce explicit manual cycle APIs and tests;
2. change read paths so they never create or calculate cycles;
3. migrate creation and detail experiences to the new model;
4. migrate payment actions to explicit cycle selection;
5. revise dashboard and status behavior;
6. preserve legacy cycles and payment links;
7. enable derived legacy-conflict messaging;
8. remove obsolete calculator, rebuild, and due-date code after all consumers
   have moved.

At no point should migration silently rewrite historical cycle boundaries or
payment assignments.
