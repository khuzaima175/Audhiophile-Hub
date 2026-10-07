# Implementation evidence

Updated 2026-10-07. Implementation commits: milestone 0 `33a889c`, 1 `2b2ca54`, 2 `1b50a08`, 3 `cc41e36`, 4 `d17f873`, 5 `2263b47`, 6 `2161d1b`, 7 `868c97d`. Earlier milestone paragraphs record evidence at that point in implementation; the final milestone and [verification report](../VERIFICATION_REPORT.md) record consolidated results. Follow [manual testing](MANUAL_TESTING.md) to check live accounts and devices.

Starting revision: bc96299a4e51b889cbbfda55f991dc187bcecef9. Working tree clean at start. User plan preserved in [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md). Deployment is separate.

## Milestone 0

Passed baseline: TypeScript, production build, core tests, APO fixtures. Browser audit uses installed Chromium; Edge is unavailable on this host.

Confirmed by code: Options menu clipped inside scrolling graph rows; independent Escape handlers; inconsistent key resolution; build-time shared-key injection; dropdown default differs from graph default; display transforms used as fitting inputs; saved measurements/preamp not restored; stale fit plotted after editing.

Needs verification: exact reported toast overlaps, live model availability/account permissions, deployed public assets, physical listening, Edge/WebKit, Windows APO integration.

Implemented portal Options with scroll/resize placement, touch pointer dismissal, keyboard focus navigation/restoration. Registered surfaces dismiss one at a time. Passive notifications use a pointer-transparent accessible area. Key resolution is shared; capability test makes a streaming request with grounding. Model catalog is centralized; research only falls back for unavailable models. Production environment injection is removed (both GEMINI and VITE_GEMINI sources remain development-only). Personal browser keys are used for hosted mode. No deployed URL or affected credential is available; deployed exposure/rotation cannot be verified here.

## Milestone 1

Shared version-2 draft now persists identity, dirty state, mode, graphic and enabled parametric filters, selected band, stable gear/source/target references, requested preamp, rate and analysis settings. Save keeps the draft; Save as copy creates an independent preset. Replacing unfinished work asks for an explicit choice. Undo/Redo is capped at 60 entries and supports grouped/canceled gestures. Legacy presets are adapted on open without rewriting original legacy data. Measurements use SHA-256 references in IndexedDB with transactional writes. Storage failures retain in-memory draft and offer retry; unknown/damaged drafts block overwrite and offer preserved-original recovery. Backup integration and full migration regression matrix follow in milestone 7.

Validation: TypeScript passes. Baseline browser DSP passes 4,842 comparisons, max error 0.000005715 dB in Chromium. Physical audio and Edge/WebKit remain unrun.

## Milestone 2

Graph default is explicit in state. Inferred modes require correction data with an assumed target. Solo preserves visibility choices. Original-data CSV excludes display offset; displayed CSV records mode, normalization, smoothing, delta, per-curve offset/inversion, and provenance. Fitting uses original arrays with explicit independent fitting smoothing/normalization, catches errors, and sends a correction plus source link into the shared editor. Targets offer manual EQ; generating correction requires measured source data. Current post-EQ response follows current filters; the original fit retains its settings and evaluation point count. Invalid normalization anchors suppress unsupported plots.

Passed core regressions: 280–281 Hz empty overlap fails; non-finite inputs fail; unsupported 1 kHz anchor fails; unsorted inputs are sorted and duplicate frequencies averaged. No empty RMS can report success. TypeScript passes. Production build passes.

## Milestone 3

Automatic headroom and manual requested preamp share an effective response-based attenuation policy. Manual requests are preserved separately from protective attenuation; the UI explains adjustments. Current post-EQ graph includes absolute attenuation; correction view is response shape. Presets and APO exports retain rate assumptions; playback uses the actual AudioContext rate. A playback lease stops the previous owner on source changes and ends its live capture. File decoding has cancellation epochs. Raw bypass is distinguished from optional first-10-second all-channel RMS matching (dry attenuation limited to 24 dB; invalid/unavailable metrics revert visibly to raw). Matching invalidates when source or filters change. DSP coefficients remain unchanged.

Core regression passes for policy and APO preamp round trips at 44.1/48/96 kHz. Wavelet exports are explicitly approximate sampled responses (existing 127-point grid); deep notches/narrow features require external comparison and are not claimed lossless. Physical listening and real Windows APO remain unrun.

## Milestone 4

Numbered graph handles synchronize with numeric edits and selected-band controls. Parametric frequency drag is logarithmic; gain applies only to bell/shelf types. Pass/notch controls avoid ignored gain. Graphic bands drag vertically at fixed frequencies. Pointer capture locks ownership and graph range for the whole gesture; cancel/Escape restores its start. Each drag is one capped Undo entry. Updates coalesce per animation frame and gesture persistence occurs on completion. Handles have 44 CSS-pixel hit areas, keyboard frequency/gain editing, and mobile selected-band controls. Measurements/targets remain protected. Add, Reset, Bypass, Undo, Redo are visible.

TypeScript passes; browser interaction journeys are recorded with milestone 7.

## Milestone 5

Semantic near-black/graphite/gray/soft-white tokens drive Tailwind and CSS; the explicitly loaded Tailwind configuration is retained. Blue focus indicators and independent graph-series colors remain. Starting cards distinguish Research, Manual EQ and Measurement-based EQ; measurement guide permits direct access. Fader ticks/zero position use actual numeric ranges. Mobile primary controls have 44-pixel minimum heights and reduced motion is respected. View/selection changes no longer dirty audio parameters. Preference-to-draft action and per-answer requested/answering metadata are connected alongside the research integration in milestone 6.

TypeScript passes. Browser smoke passed overview, research composer, profile persistence, gear operations, listening notes, EQ import/save/new-draft checks. Updated semantics required selector changes; complete run follows in milestone 7.

## Milestone 6

Recorded legacy baseline: keywords >3 characters select sessions and supply unrelated last four messages; knowledge notes are not ranked, summaries have no coverage tracking, all memories are sent. Acceptance for the labeled local fixture: 3/3 intended passage hits, 0 false hits on 3 negative/disabled queries, no stale summaries/duplicates, serialized quoted context within character budget, current-chat exclusion. BM25 selected on this fixture because it retrieves matching passages and short terms that baseline misses. This small fixture is a regression set, not a broad quality benchmark.

Typed source records have stable IDs, revision, provenance, timestamp, enabled/pinned status. Exact tokens retain FR/Q/DD/BA and product identifiers. Current chat is separate; older conversation retrieval is opt-in. Summaries require matching source revision; unknown legacy coverage remains preserved but is excluded until regenerated. Notes support edit/disable/pin/delete. The index is rebuilt per request so edits/deletes cannot leave a stale cache. JSON quoted sources are explicitly untrusted; adversarial quoting tests validate framing but do not prove prompt-injection immunity. Selected preference fields share the ranking/budget. Each answer persists Context supplied metadata and its requested/answering model; Sources cited requires grounding support indices.

Preference controls explicitly create a manual draft to affect audio. Credential testing remains unrun without a user key. No external embeddings or data-sharing path was added.

## Milestone 7

Version-3 complete backups include drafts, measurements, comparison state, retrieval settings and source links. Restore validates modes/numbers/schema/duplicate IDs, stages originals plus large structured records in IndexedDB, preserves old records, and rolls back failed local writes. Missing source/gear links require explicit manual recovery or cancellation. Pending restore markers expose interruption; Recover previous workspace validates the staged originals, and complete exports include raw preserved recovery data. Damaged/unknown drafts and comparison originals remain exportable. Credential storage is outside the backup whitelist.

Source comparison opens the current measurement, correction shape and current post-EQ result with stable IDs and attenuation provenance. Absolute post-EQ series keep attenuation in comparison plots and exports. Graph CSV/share metadata includes transformations, absolute-level policy and independent fit settings. Final visual review removed remaining green CSS chassis surfaces; series colors remain independent. Desktop/mobile popovers, keyboard/pointer gestures and focus restoration are verified.

Desktop comparison curves and selected-band controls sit beside their graphs; mobile panels stack or expand. Solo preserves saved visibility. Escape closes ephemeral Advanced/composer/session disclosures before their containing surface, while popovers and active drags keep priority; the workspace regression covers Advanced and portal dismissal separately.

Passed: typecheck, production build, core, APO, six-query retrieval fixture (3 intended hits vs legacy 0), UI smoke, workspace/recovery journeys, Chromium mobile sizes, 4,842 independent response points plus six rendered-audio cases. Production SDK streaming/grounding and unavailable-model behavior are tested with mocked responses, including selected/answering model provenance and disabled-source exclusion. A production build with both placeholder environment keys contains neither placeholder.

Unrun: deployed asset inspection/rotation (no URL/credential), live account/model authorization, Edge/WebKit, physical listening/mobile device, real tab capture/microphone and Windows APO. Original exact toast overlap remains unreproduced. See VERIFICATION_REPORT.md for evidence and limits. No deployment performed.

## Documentation consolidation

All repository Markdown entry points now describe the current shared draft, linked measurements, direct graph editing, black responsive UI, retrieval/provenance and recovery behavior. The older root UI-fix plan is a compatibility status page; historical README/report snapshots carry explicit superseded notices. The manual guide includes clone/pull setup, a synthetic measurement fixture, four main acceptance journeys, physical/live checks and static production preview. No live/deployed verification result is upgraded by this documentation update.

## Preferred model correction

Restored the user's configured Gemini priority to 3.8 Flash → 3.7 Flash → 3.5 Flash-Lite through the shared catalog used by defaults, dropdowns, connection testing and AI services. README/UI guidance now matches this order. Typecheck, build and the extended production browser regression passed, including both mocked fallback steps and requested/answering model provenance. Existing conversation metadata is preserved; live account availability is still unrun.
