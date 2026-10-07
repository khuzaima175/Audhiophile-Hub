# Updated AudioSage implementation plan

Status updated 2026-10-07: implementation milestones 0–7 are delivered in separate commits, ending at `868c97d`. The requirements below are retained for traceability. Delivery does not mean all live/deployed/physical acceptance checks were available: see [implementation evidence](IMPLEMENTATION_EVIDENCE.md), [verification results](../VERIFICATION_REPORT.md), and [manual testing](MANUAL_TESTING.md). Current UI and behavior are described in [README](../README.md) and [UI_REDESIGN.md](../UI_REDESIGN.md).

Based on repository revision bc96299a4e51b889cbbfda55f991dc187bcecef9 and the verified plan review.

Goal: one reliable Audio workspace for manual EQ, measurement-based correction, comparison, and presets, alongside a clearer research workflow and improved local retrieval.

Each milestone should be independently reviewable, with its own commit, relevant regression or visual/accessibility checks, and updated verification report. Update documentation whenever documented behavior changes. Deployment is a separate release step.

## Milestone 0 — Establish evidence and repair immediate blockers

- Record the revision, preserve existing local changes, and maintain an issue list labeled reproduced, confirmed by code, or needs verification.
- Retain the current passing baseline: TypeScript, production build, core tests, APO fixture tests, and the 4,842-point browser DSP audit.
- Fix Graph Lab Options using a portal-based popover with viewport-aware positioning, scroll/resize handling, outside dismissal, keyboard navigation, touch support, and focus restoration.
- Make Escape dismiss the nearest active surface before closing Graph Lab. Prevent multiple independent handlers from dismissing several surfaces on one keypress.
- Reproduce reported toast overlaps. Define a notification area that avoids controls, does not intercept clicks for passive messages, and announces updates accessibly.
- Use one key resolver for research and connection testing. Support the same browser, GEMINI_API_KEY, and VITE_GEMINI_API_KEY sources and show source plus configured/verified/failed status without revealing key values.
- Centralize model IDs and labels. Validate availability and the actual request capabilities, including streaming and grounding where used. Keep credential rejection, unavailable model, quota, and network errors distinct.
- Inspect the deployed public assets for shared-key exposure without printing or copying credentials into reports. The existing build mechanism embeds build-time Gemini keys; deployed exposure remains unverified.
- Use browser-provided personal keys for personal-key mode. If hosted shared-key mode is required, use a protected service with access controls and usage limits.
- If shared-key exposure is confirmed, remove the exposure path and rotate/revoke the affected key through the appropriate secure process before release.

Acceptance:
Options actions work with mouse, keyboard, and touch at desktop and mobile widths; Escape closes one surface; key status reflects the operation tested. Any confirmed shared-key exposure is resolved before publication.

## Milestone 1 — Introduce one draft, ownership model, and compatible storage

Create one Audio workspace with Editor, Compare, and Presets views. Graph Lab becomes its comparison/expanded-graph view. Preserve existing navigation entry points during migration.

Define a versioned shared draft containing:

- Preset identity, name, stable gear ID, and dirty state.
- EQ mode, enabled filters, graphic bands, selected band/filter.
- Stable measurement and target references.
- Requested preamp, preamp mode, effective attenuation, and sample-rate policy.
- Analysis settings, including explicit fitting smoothing and normalization.

Also:

- Keep source measurements, reference targets, editable corrections, and display transformations separate.
- Store large measurement arrays in structured storage such as IndexedDB, deduplicated through stable references.
- Establish one playback owner and explicit source-switching rules.
- Add explicit Save and Save as copy.
- Preserve unfinished drafts across navigation and refresh.
- Define mode-change and import behavior; warn before replacing dirty work.
- Add capped Undo/Redo history. Group a complete drag into one history entry and define cancellation semantics.
- Implement legacy migrations, validation, backup coverage, quota handling, and recoverable writes as the new schema is introduced.
- Preserve original legacy data until migration succeeds. Handle unknown schema versions and missing linked measurements with recovery choices.
- Keep credentials out of drafts and backups.

Acceptance:
Create, open, edit, save, copy, navigate away, refresh, and reopen all use the same draft. Measurement, target, gear, filter enablement, and preamp information survive. Representative legacy data migrates without silent loss.

## Milestone 2 — Correct graph and fitting semantics

- Set an explicit default graph mode in state and use it consistently in the dropdown, plot, cursor, and exports.
- Offer only modes supported by the data present.
- Compute the current post-EQ response from the source measurement and current draft filters. Distinguish normalized response shape from absolute attenuation.
- Preserve the original automatic-fit result as a separate result with its own settings; editing filters must update the current response rather than displaying the old fit as current.
- Fit source data with explicit analysis settings. Display offset, Solo, inversion, and difference views must not silently alter fitting inputs.
- Restrict fitting and plotted response to valid overlapping support and sample-rate limits.
- Reject invalid inputs: non-finite values, unsupported normalization datum, missing/disjoint support, and ranges containing no evaluation points. Define sorting and duplicate-frequency handling.
- Eliminate the reproduced false success where a 280–281 Hz overlap reports a 100% match with zero evaluated points.
- Make normalization, target offsets, cursor readouts, and exports use consistent definitions.
- Preserve visibility choices before and after Solo.
- Provide separate original-data and displayed-data exports, with transformation metadata.
- Make curve type, line style, provenance, point counts, and assumptions readable.
- Treat target-minus-correction reconstruction as an inference based on an assumed source target, not a measured headphone response.
- Catch fitting failures with useful recovery messages and invalidate results when their inputs change.

Acceptance:
The selected mode, graph, cursor, fit, and export describe the same operation. Invalid or empty evaluations fail visibly. Display-only changes leave source-based fitting unchanged.

## Milestone 3 — Align audio, preamp, presets, and exports

Complete the audio foundation before adding direct graph dragging.

- Implement Automatic headroom and Manual preamp modes.
- Preserve imported/saved requested preamp values; show effective attenuation and explain protective adjustments.
- Use one effective policy for playback, plotting, saving, and exporting.
- Make sample rate explicit. Playback uses the active AudioContext rate; fitting and plotted response must use the intended rate and document any external-player assumptions.
- Verify matching-rate behavior at 44.1, 48, and 96 kHz, respecting Nyquist limits.
- Keep the tested biquad implementation unless new evidence identifies a defect.
- Provide raw bypass and optional level-matched comparison with distinct labels. Define the comparison signal/segment, level metric, gain limits, and invalidation behavior.
- Describe headroom as response-based attenuation; do not claim it is a true-peak limiter or guarantees every signal cannot clip.
- Verify source switching, filter enablement/type changes, shelves, playback interruption, and cleanup under the single-owner model.
- Define conversion fidelity by format. Supported APO parameter round trips should preserve semantics and preamp. Wavelet sampling and Wavelet-to-PEQ fitting are approximations.
- Specify the frequency grid, response tolerances, and treatment of deep notches before accepting conversions. Include preamp in absolute-response comparisons and show conversion error when appropriate.
- Keep APO integration explicitly local. Hosted behavior provides export instructions.
- Validate rendered audio/frequency response automatically; record physical listening results separately when performed.

Acceptance:
Saved, reopened, plotted, played, and exported EQ agree under the documented rate and preamp policy. Supported parameter round trips preserve values; approximate conversions meet their defined tolerances or display an explicit limitation.

## Milestone 4 — Add direct graph editing

- Add numbered handles synchronized with numeric controls and the selected filter.
- Use logarithmic frequency dragging and gain dragging where meaningful.
- Provide controls appropriate to bell, shelf, pass, and notch filters. Avoid controls that imply a parameter has an audible effect when that filter type ignores it.
- In graphic mode, use fixed-frequency vertical dragging.
- Provide visible Add band, Reset, Bypass, Undo, and Redo actions.
- Use pointer capture, explicit cancellation behavior, and stable graph bounds throughout a drag.
- Group each completed gesture into one Undo action.
- Add keyboard editing, large touch hit areas, and a mobile selected-band sheet.
- Smooth audio updates and schedule expensive calculations so interaction stays responsive.
- Keep measurements and reference targets protected. Any future target editing is a separate explicit mode.

Acceptance:
Mouse, touch, keyboard, and numeric edits produce identical parameters, correction response, and playback behavior. Dragging does not move the coordinate system, lose pointer ownership, or generate hundreds of Undo entries.

## Milestone 5 — Simplify navigation and apply the black theme

Use near-black backgrounds, graphite panels, gray borders, soft-white text/buttons, restrained blue focus indicators, and independent graph-series colors.

- Centralize semantic color tokens and migrate hardcoded green surfaces.
- Keep tailwind.config.js until its explicitly loaded configuration has been migrated and verified.
- Use one graph/editor layout: desktop curve list, graph, and selected-band controls; mobile compact toolbar and expandable Curves/Band panels.
- Provide separate starting actions for Research, Manual EQ, and Measurement-based EQ.
- Add a guided measurement workflow without blocking direct access for experienced users.
- On a reference target without a measurement, offer Start manual EQ. Require suitable source data for Generate correction.
- Replace modal Close controls only when a working page-navigation replacement exists.
- Remove duplicated icons, outdated terms, and misleading color descriptions.
- Calculate displayed point counts from actual arrays.
- Preserve the selected/requested model separately from the model that answered, and record the answering model on each response.
- Label profile sliders as preference controls. If they should produce audio changes, provide an explicit Create EQ draft action.
- Position fader ticks and zero markers from numeric values, including asymmetric ranges.
- Verify focus visibility, contrast, reduced motion, and approximately 44-pixel primary mobile touch targets.

Acceptance:
Users can identify what changes audio, preferences, and display. Research, manual EQ, and measurement-based EQ are all easy to start, and the shared workspace consistently uses the new theme.

## Milestone 6 — Improve local retrieval with measured results

- Document the existing keyword baseline and its limits.
- Create typed indexed records with stable IDs, timestamps, provenance, enabled state, and source revisions.
- Retrieve matching passages rather than unrelated trailing messages.
- Preserve short audio terms and product/model identifiers.
- Keep current-conversation context separate from optional older-conversation retrieval.
- Select relevant profile fields instead of routinely including every memory.
- Deduplicate notes, summaries, and excerpts; track summary freshness through source revision or message coverage.
- Label AI summaries as generated summaries and separate user preferences from external technical claims.
- Support editing, disabling, pinning, and deletion. Propagate changes to indexes, caches, and derived summaries.
- Apply relevance thresholds and an explicit context budget with defined units.
- Evaluate BM25 or another local ranking method against a labeled query set before choosing it.
- Include short-term queries, product names, negative queries, stale summaries, disabled records, and duplicates. Define quality and budget acceptance criteria before implementation.
- Treat retrieved material as quoted source data and add adversarial cases; quoting alone is not a guarantee against prompt injection.
- Persist per-answer metadata for Context supplied. Use Sources cited only for material actually cited in the response.

External embeddings are a later opt-in option, justified by measured improvement and clear data-sharing behavior.

Acceptance:
Evaluation queries retrieve the intended passages, exclude disabled/deleted material, respect budgets, and expose accurate supplied-context metadata. Results improve on the recorded baseline.

## Milestone 7 — Consolidate recovery and release verification

- Extend versioned backups to include drafts, measurements, comparison sessions, retrieval settings, and all linked records.
- Run the complete migration matrix using representative old backups and interrupted/failed migration cases.
- Validate numeric values, modes, references, duplicate IDs, unknown versions, and missing records.
- Exercise storage quota and write failures without silently discarding work.
- Confirm navigation preserves drafts and destructive replacement requires an explicit choice.
- Verify production behavior as well as development behavior, including environment-key handling, lazy loading, persistence, exports, and hosted/local integration differences.
- Remove old components only after checking imports and behavior.
- Rewrite documentation around the current product and evidence-supported claims.
- Keep passed, failed, skipped, unrun, and physical-device limitations distinct.

Acceptance journeys:

1. Measurement-based: Import measurement → generate EQ → drag a filter → verify response/playback → assign gear → save → refresh → reopen with source links intact → export → reimport → compare parameters or response using format-specific tolerances.
2. Manual: Start manual EQ → adjust bands → preview → assign gear → save → refresh → reopen.
3. Research: Configure a usable key → select model → ask a retrieval-backed question → inspect context supplied and answering model → disable a source → verify it is excluded from the next request.
4. Recovery: Import a legacy backup → migrate → simulate a failed write → recover preserved work → export and restore a complete versioned backup.

Release only after required checks pass and confirmed credential exposure has been resolved. Keep unverified model availability, specific toast overlaps, Edge/WebKit behavior, physical audio behavior, and real Windows APO integration explicitly identified until tested.
