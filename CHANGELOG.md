# Changelog

All notable changes to this project should be documented in this file.

The format is intentionally simple and release-focused so it can double as GitHub release notes.

## [2.0.1] - 2026-07-23

### Changed

- Limited the cycle selector timeline to two alternating lanes so its height stays compact regardless of cycle count.
- Lightened unselected cycle bars and strengthened the selected-cycle color for clearer visual focus.

### Added

- Added a red icon-only delete action beside the selected cycle dates, with confirmation and existing backend protections for linked payments.

### Notes

- Release tag: `v2.0.1`
- App version: `2.0.1`


## [2.0.0] - 2026-07-23

### Added

- Added fully manual bill-cycle management with a calendar-style selector, draggable linked boundaries, saved-cycle review, and explicit cycle selection for payments.
- Added a standalone cycle viewer showing paid amounts and linked payments while preserving the existing dashboard, bill summary, and payment-history chart layouts.
- Added database migration integration coverage for fresh databases, tracked v1.4+ databases, missing migration metadata, unsupported legacy schemas, and safe reset behavior.

### Changed

- Removed automatic current-cycle calculation and future-cycle prediction. Bill frequency is now descriptive and only seeds an adjustable placeholder when creating a cycle.
- Removed cycle and due-date questions from bill creation; cycles are created manually and payments must be assigned to an explicit saved cycle.
- Changed paid-cycle actions to always allow adding another payment, supporting multiple payments per cycle.

### Fixed

- Rebuilt the payment-cycle foreign key as `ON DELETE NO ACTION` so cycles with linked payments cannot be deleted accidentally.
- Made database initialization deterministic and idempotent while preserving existing bills, cycles, payments, rental notifications, conflicting dates, gaps, and overlaps.
- Restored the established bill-card and detail-page UI while improving cycle drag feedback and compact linked-payment actions.

### Notes

- Release tag: `v2.0.0`
- App version: `2.0.0`
- This major release changes cycle management from automatic prediction to explicit manual control.


## [1.5.0] - 2026-06-25

### Added

- Added optional Rental Management, with a Settings toggle, rental asset flags, charge-to-tenant bill flags, and a Rentals page grouped by rental asset.
- Added tenant notification tracking for chargeable rental payments, including yes/no notification status and notify date.
- Added compact Activity browsing with filters, expandable details, and incremental loading.

### Fixed

- Fixed edit-payment cycle selection so editing an existing payment keeps its original cycle instead of jumping to a newer unpaid cycle.
- Improved Rental Management navigation responsiveness when toggling the setting.
- Improved rental asset list styling, including type-specific icons, configured asset colors, inline rental badges, and neutral selected-state borders.

### Notes

- Release tag: `v1.5.0`
- App version: `1.5.0`


## [1.4.2] - 2026-06-24

### Changed

- Removed the previously added Dockhand webhook automation so releases continue to rely on GHCR image publishing without assuming a public deploy callback URL from Unraid.

### Notes

- Release tag: `v1.4.2`
- App version: `1.4.2`


## [1.4.1] - 2026-06-24

### Fixed

- Fixed recurring cycle regeneration so bills with due dates earlier than cycle end dates no longer create duplicate cycles on each load.
- Fixed current-cycle resolution for edited recurring bills so paid variable-cycle payments are no longer hidden behind duplicate unpaid cycles.
- Deduplicated repeated cycle choices in the payment modal and added server-side cleanup to merge duplicate cycles back into a single canonical cycle.

### Notes

- Release tag: `v1.4.1`
- App version: `1.4.1`


## [1.4.0] - 2026-06-24

### Added

- Added a persistent activity logging system with request IDs, structured server events, audit-focused activity storage, and a new Activity page in the main navigation for reviewing recent warnings, errors, and business events.

### Changed

- Simplified automatic payment notes so recorded payments no longer append the original amount by default.
- Improved bill creation and editing feedback with clearer validation handling, richer backend request logging, and in-page error messaging for failed bill creation.
- Corrected payment history stats so the `Last` amount is based on the most recent paid cycle instead of the oldest returned cycle.

### Notes

- Release tag: `v1.4.0`
- App version: `1.4.0`


## [1.3.0] - 2026-06-24

### Fixed

- Audited date handling across bill forms, payment entry, bill detail history, and related API fallbacks so date-only values now stay aligned with the user-selected calendar day across time zones.
- Fixed payment history and payment editing flows that could display or refill payment dates one day early on devices west of UTC.
- Tightened the Bills dashboard card header spacing and simplified recurring/autopay indicators with a lighter inline legend.

### Notes

- Release tag: `v1.3.0`
- App version: `1.3.0`


## [1.2.2] - 2026-06-24

### Fixed

- Simplified the recurring and autopay badges on dashboard bill cards to icon-only markers for a more compact header.
- Added a lighter, inline dashboard legend beneath the search/filter area so the new icon-only bill markers remain understandable without adding visual weight.

### Notes

- App version: `1.2.2`


## [1.2.1] - 2026-06-23

### Fixed

- Rounded the payment history chart Y-axis to integer tick values so the min and max labels no longer show long floating-point decimals.
- Tightened the Bills dashboard card header layout so category icons, titles, and recurring/autopay badges align more consistently across mixed bill types.

### Notes

- Release tag: `v1.2.1`
- App version: `1.2.1`

## [1.2.0] - 2026-06-12

### Changed

- Renamed the app from `Billzzz` to `BillTrack` across the UI, Docker image references, export filenames, and repository metadata.
- Updated local and deployment-facing naming to use `billtrack`, including container and compose service names.
- Switched the Unraid/Dockhand host data path in `docker-compose.yml` to `/mnt/user/appdata/billtrack`.

### Added

- Added `RELEASE.md` to document the required release process.
- Added an explicit rule that `package.json` version must match the git tag version before creating a release tag.

### Notes

- Release tag: `v1.2.0`
- App version: `1.2.0`

## [1.1.0] - 2026-06-12

### Changed

- Refined the Bills dashboard by removing summary cards and replacing the filter area with a cleaner, more modern toolbar layout.
- Redesigned the bill detail page to emphasize the current cycle, clarify primary actions, and improve payment history presentation.
- Reworked the create/edit bill form into a clearer step-by-step flow with better billing, amount mode, cycle anchor, and payment sections.
- Reorganized the Settings page into clearer groups: Appearance, Payment Setup, Bill Metadata, and Data Management.
- Restyled the top navigation bar to better match the rest of the refreshed UI.

### Added

- Added a reusable status system for bill and cycle states, including shared status mapping and badge presentation.
- Added dynamic Y-axis padding in the payment history line chart so values render more naturally in the chart area.

### Fixed

- Improved consistency of bill and cycle status display across cards, detail views, and filters.
- Improved title presentation on the main top-level pages by matching page headers with their navigation icons.

### Notes

- Release tag: `v1.1.0`
- App version at release time should match `1.1.0`

## [1.0.0] - 2026-06-11

### Added

- Added a formal Docker image publishing workflow for GitHub Container Registry.
- Added version-aware image publishing for `latest`, `main`, `sha-*`, and semantic version release tags.
- Added app version display support in the UI.

### Changed

- Switched deployment guidance and compose configuration toward published GHCR images instead of repo-sync rebuilds.
- Documented a release-oriented deployment flow for Unraid / Dockhand.

### Included From Earlier Work

- Unified time storage/handling so the app can use a more consistent date format strategy.
- Fixed modal close behavior when dragging outside edit/add bill dialogs.
- Redesigned bill cycle handling and bill forms around cycle-based billing data.
- Added payment editing support and improved cycle recalculation behavior.
- Reworked payment history presentation, including the shift back to a line chart-based view.

### Notes

- Release tag: `v1.0.0`
- This was the first formal tagged release using the new versioned image workflow.
