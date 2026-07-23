# Cycle Selector Two-Lane Controls

## Goal

Keep the cycle selector compact regardless of cycle count, expose cycle deletion beside the selected boundaries, and make selection visually clearer without changing the surrounding bill-detail UI.

## Timeline layout

- Sort saved cycles by start date using the existing calendar-date decoding behavior.
- Assign sorted cycles to two fixed lanes by index parity: even indexes use the upper lane and odd indexes use the lower lane.
- The timeline body always reserves exactly two cycle-bar heights when cycles exist. Adding more cycles must not increase its height.
- Boundary drag previews remain in the same lane as their saved cycle.
- The month header, day grid, drag tooltip, horizontal scrolling, and left/right resize handles retain their current behavior.

This alternating layout is intentionally based on adjacency, not overlap detection. It gives every neighboring pair separate vertical space while keeping the selector height deterministic.

## Selection colors

- Unselected cycle bars use a lighter blue background with dark blue text.
- Hovering an unselected bar may slightly deepen its light-blue background.
- The selected cycle uses the existing stronger blue treatment with white text and its selection ring.
- Resize handles remain visible only on the selected cycle.

## Delete control

- Add a red icon-only delete button after the Start Date and End Date controls.
- Use the existing Lucide `Trash2` icon with an accessible label and tooltip.
- Ask for confirmation before sending the delete request.
- The bill detail page calls the existing cycle `DELETE` endpoint.
- While a cycle mutation is in progress, disable the button.
- Backend rules remain authoritative: cycles with linked payments or invalid middle-cycle deletions continue to return their existing errors, shown through the selector error message.
- After successful deletion, reload page data. Existing selected-cycle fallback logic chooses the latest remaining cycle or no cycle when none remain.

## Testing

- Add a unit-tested lane helper proving that any number of sorted cycles maps only to lanes `0` and `1`.
- Add source-level UI assertions for the fixed two-lane container, alternating lane positioning, light/dark selected colors, icon-only delete control, confirmation, and delete endpoint wiring.
- Run the existing cycle selector, bill UI, manual cycle, full component/unit, type-check, and production-build verification.
