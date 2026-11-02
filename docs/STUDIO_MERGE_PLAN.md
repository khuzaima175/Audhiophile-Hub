# Studio merge: reviewed scope and remaining work

Updated 2026-11-02. This tracked plan supersedes the earlier external brain document, whose header and Step 4 instructions were stale.

The release branch `codex/release-steps-1-3` starts at main (`aadaa91`) and cherry-picks only `f934c20`, `372b1be`, `b6d5157`, `84371b8`, and `392bd71`. It excludes the unapproved Step 4 fit-limits change `8b6669b`, which remains on `studio-merge`. All Step 4 work is held until the deployed friend test is complete. No combined Studio screen or store migration has been implemented.

## Step 3: save and Windows application

Save and Save as copy update only the browser library. Apply to Windows explicitly exports the current draft with its effective preamp, writes the APO sibling file, and enables its managed include. The Settings switch controls that include; it never enables apply-on-save. The old opt-in flag also selects users who see the one-time migration notice.

Before the first successful Apply for each config path, a confirmation explains that it adds an include line to config.txt with a backup, writes audiosage-eq.txt and affects system audio. Cancel performs no sync. Consent is persisted only after success, so a changed path or failed first Apply requires confirmation again.

Persist the last successful applied signature and label. A reload restores this local history and explicitly marks Windows state unverified, because neither browser storage nor the existing bridge proves what Windows currently contains. Without history, show Applied: unknown. Failed Apply must retain the last successful record.

Back to presets preserves the draft. A dirty draft appears in the presets list with Resume and Discard actions. Discard requires confirmation and preserves saved presets. Distinguish a missing hosted bridge, missing local config, and failed temporary write/readback permission probe. The probe never writes the active EQ or config file.

## Step 4: EQ definition and view state

- Keep `targetCurveId` in view state: it is the currently displayed reference. Keep `selectedTargetId` in the draft: it identifies the fitted target. They serve different purposes.
- Keep viewport ranges, graph settings, display normalization and display smoothing in view state. Name the future internal field `displaySmoothing`; use `fitSmoothing` for the draft fitting field. Explicit persistence adapters retain the existing serialized `smoothing` keys. Current code retains existing names until that migration is reviewed.
- Graph Lab and the editor retain their separate fit-limit settings in this release; the draft-owner change is excluded. Fit smoothing/normalization also still differ. Preserve these results until Step 4 is reviewed after the friend test.
- Undo/redo should cover EQ edits and grouped gestures, excluding view settings and imported curve arrays. Add an explicit draft/delta audition source. These remain future work.

## Compatibility rules

- Golden fixtures are immutable. The three original share cases and complete storage/backup fixtures from `372b1be` must remain byte-identical; new share cases may only be appended. Restore the original provenance header if later tooling changed it. The generator writes candidates under ignored artifacts only.
- Share fixture assertions compare `decodeUrlToLabState(url)` directly to the committed decode output. Never reconstruct decoded URL fit settings from the current draft.
- `toLegacyLabStateSnapshot(viewState, draft)` belongs only in storage/backup compatibility tests. Preserve any legacy URL fit metadata separately during hydration. Opening a share link must not overwrite in-progress EQ work.
- The two automated browser captures are additional synthetic coverage. They are not evidence of compatibility with historical links actually shared by users. Such links must be supplied; do not manufacture them or search private browser history without authorization.

## Step 5: graph controls and hidden Studio route

Extract editor components without behavior changes, then build the hidden Studio route before replacing navigation. Drag handles only when the displayed active filter curve matches its true, unshifted gain response. A view-mode name alone cannot establish this.

Current GraphLab math shows raw filter gain only for a non-inverted filter in rawFilter view, with no curve offset, baseline subtraction, global delta, or per-curve delta compensation. Display smoothing can also change the plotted response. Other branches reconstruct or normalize response; measured curves in rawFilter still use normalized acoustic values. Determine eligibility from the actual curve/transforms and require plot-to-audio parity. Otherwise offer an explicit switch to a true correction view while keeping numeric controls available. Lock the Y range during gestures and isolate handle pointer events from curve selection/hover.

## Remaining sequence

Finish Step 3 evidence first. Review before merging/deploying. Run the friend workflow on the approved deployed build; a scripted browser journey cannot substitute for a real friend's feedback. Accessibility follow-up covers 44px touch targets, plain labels/hints, first-run flow, focus/screen-reader status, contrast/reduced motion and 320px layouts. Studio extraction, handles, hidden route, navigation migration and deletion of old components follow as individually verified commits, with review before behavior changes.
