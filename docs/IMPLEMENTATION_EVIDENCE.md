# Implementation evidence

Starting revision: bc96299a4e51b889cbbfda55f991dc187bcecef9. Working tree clean at start. User plan preserved in IMPLEMENTATION_PLAN.md. Deployment is separate.

## Milestone 0

Passed baseline: TypeScript, production build, core tests, APO fixtures. Browser audit uses installed Chromium; Edge is unavailable on this host.

Confirmed by code: Options menu clipped inside scrolling graph rows; independent Escape handlers; inconsistent key resolution; build-time shared-key injection; dropdown default differs from graph default; display transforms used as fitting inputs; saved measurements/preamp not restored; stale fit plotted after editing.

Needs verification: exact reported toast overlaps, live model availability/account permissions, deployed public assets, physical listening, Edge/WebKit, Windows APO integration.

Implemented portal Options with scroll/resize placement, touch pointer dismissal, keyboard focus navigation/restoration. Registered surfaces dismiss one at a time. Passive notifications use a pointer-transparent accessible area. Key resolution is shared; capability test makes a streaming request with grounding. Model catalog is centralized; research only falls back for unavailable models. Production environment injection is removed (both GEMINI and VITE_GEMINI sources remain development-only). Personal browser keys are used for hosted mode. No deployed URL or affected credential is available; deployed exposure/rotation cannot be verified here.

## Milestone 1

Shared version-2 draft now persists identity, dirty state, mode, graphic and enabled parametric filters, selected band, stable gear/source/target references, requested preamp, rate and analysis settings. Save keeps the draft; Save as copy creates an independent preset. Replacing unfinished work asks for an explicit choice. Undo/Redo is capped at 60 entries and supports grouped/canceled gestures. Legacy presets are adapted on open without rewriting original legacy data. Measurements use SHA-256 references in IndexedDB with transactional writes. Storage failures retain in-memory draft and offer retry; unknown/damaged drafts block overwrite and offer preserved-original recovery. Backup integration and full migration regression matrix follow in milestone 7.

Validation: TypeScript passes. Baseline browser DSP passes 4,842 comparisons, max error 0.000005715 dB in Chromium. Physical audio and Edge/WebKit remain unrun.
