# Cycle Viewer Layout Correction

## Goal

Correct the bill dashboard and detail layout without redesigning existing controls.

## Final structure

- Dashboard bill cards remove the empty row formerly reserved for payment-status badges.
- The Cycle Selector keeps its timeline and boundary inputs. During handle dragging, the preview date appears as an absolutely positioned tooltip inside the timeline, so no surrounding content moves.
- Add Cycle uses a neutral surface/background button with a blue plus icon and normal text.
- The standalone Cycle Viewer returns immediately below the Cycle Selector. It displays the selected cycle's paid amount, payment count, expected/remaining values, progress, and linked payments. Add Payment remains in the top bill card.
- Payment History contains only the line chart. It never contains a cycle dropdown or cycle payment viewer.
- Payment History renders its chart shell even with zero payments and overlays `No payment` in the empty chart.

## State and data flow

The Cycle Selector and standalone Cycle Viewer share `selectedCycleId`. Changing the selected timeline bar changes the viewer. Payment History derives chart points only from cycles with payments and does not affect cycle selection.

## Verification

Regression tests assert the final component structure, the non-layout drag tooltip, the restored standalone viewer, and the always-present history chart. Browser verification checks the visible layout and selected-cycle linkage.
