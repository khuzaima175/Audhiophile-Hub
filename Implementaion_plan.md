# AudioSage implementation status

Updated 2026-10-07. This compatibility document keeps the repository's original filename. It replaces the older six-fix UI instructions, line-number examples and blanket verification claims with the current implementation status.

The [eight-milestone plan](docs/IMPLEMENTATION_PLAN.md) is the source of requirements. [Implementation evidence](docs/IMPLEMENTATION_EVIDENCE.md) records what changed and how it was checked. Deployment remains a separate release step.

## Delivered milestones

| Milestone | Delivered behavior | Commit |
|---|---|---|
| 0 — Immediate blockers | Viewport-aware portal menus, one-surface Escape, centralized personal-key/model configuration and production build-time key exclusion | `33a889c` |
| 1 — Shared draft and storage | Persistent version-2 draft, linked IndexedDB measurements, stable gear/preset identity, Save/copy, dirty replacement and grouped Undo | `2b2ca54` |
| 2 — Graph/fitting semantics | Original-source fitting, separate display transforms, visible invalid-range failures and current response separate from original fit | `1b50a08` |
| 3 — Audio and exports | Requested/effective preamp, rate assumptions, exclusive playback ownership, raw/RMS-matched bypass and export metadata | `cc41e36` |
| 4 — Graph editing | Numbered pointer/keyboard handles, selected-band controls, cancellation and one Undo entry per drag | `d17f873` |
| 5 — Workspace UI | Three starting workflows, near-black theme, semantic tokens, responsive controls and numeric fader scales | `2263b47` |
| 6 — Local retrieval | Ranked matching passages, exact short terms, disabled/stale-source exclusion, context budgets and answer provenance | `2161d1b` |
| 7 — Recovery and verification | Version-3 complete backups, legacy validation/recovery, rollback fixtures, conversion audits, production checks and current documentation | `868c97d` |

## Current UI and workflow rules

Editor, Compare and Presets share one draft; Graph Lab is the expanded comparison view. Save retains that draft, Save as copy creates a new preset, and dirty replacement requires a choice. Source measurement arrays live in IndexedDB and remain linked through refresh. Curve transformations and Solo affect display, not the original fitting data.

Manual EQ can start without a measurement. Measurement-based EQ imports numeric data, fits a compatible target and sends editable correction filters into the draft. Research uses a personal browser key on hosted builds, with the requested model kept separate from the actual answering model. Preferences only change audio through the explicit Create EQ draft action.

The current chassis is near-black/graphite rather than the earlier sage design. Desktop curve/band panels sit beside their graphs; mobile panels stack or expand. Portal menus restore focus. Escape cancels an active drag or closes the nearest transient surface before its containing graph. Passive notifications do not intercept clicks.

## Graph Lab follow-up

Graph Lab now includes in-tab Compare curves, Edit EQ and Presets, with New EQ preset, shared handle/numeric editing, gear assignment, Save/copy, load and exports. Manual and measured correction actions remain in the tab. A stale 230-pixel CSS cap was removed; container measurements size the SVG and labels are larger. Compact Options buttons stay within the curve sidebar. The dedicated Lab journey and existing UI/workspace/mobile/production checks passed; see the verification report.

## Verification and remaining release work

Typecheck, build, core/APO/retrieval fixtures, Chromium UI/workspace/mobile checks, independent browser DSP comparisons and rendered-tone cases passed. Production research checks use mocked responses; they do not verify a real account's authorization. Local production placeholder-key exclusion passed.

Live Gemini, deployed public assets/credential rotation, physical audio/mobile devices, Edge/WebKit, capture permission flows and real Windows APO require testing in the relevant environment. The exact earlier toast-overlap report is still unreproduced. The local six-query retrieval fixture is not a general quality benchmark.

Run [manual testing](docs/MANUAL_TESTING.md) to exercise the new workflows on your machine. The [verification report](VERIFICATION_REPORT.md) is the authoritative record of passed and unrun checks; the [UI document](UI_REDESIGN.md) describes current controls. Historical snapshots under `docs/archive/` are preserved for comparison and should not guide current setup or release decisions.

## Graph Lab / Squig follow-up status

The mobile frequency-label collision and axis-covering band panel are fixed. Comparison/catalog/channel/custom-target/image workflows, constrained AutoEQ and independent stereo editing/playback/export have been added to the existing shared workspace. See [Graph Lab guide](docs/GRAPH_LAB_GUIDE.md) for feature coverage, sources and differences; verification distinguishes automation from physical/live-server checks. The Gemini priority remains 3.8 Flash → 3.7 Flash → 3.5 Flash-Lite.
