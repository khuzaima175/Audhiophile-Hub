# Step 3 review: Save presets and Apply to Windows

The current release candidate is `codex/release-steps-1-3`, excluding the unapproved Step 4 commit. On 2026-11-02, a fresh `npm run test:all` completed with all 15 checks exiting 0, and all four screenshots were opened and inspected. No merge, push, deployment, historical-user-link check, real Windows Apply, or friend feedback has been performed in this follow-up.

## Result

- Save and Save as copy write only to the browser library, including for previously opted-in APO users. The fetch spy records zero `/api/apo/sync` requests for both actions. Apply records exactly one request with the guarded EQ export.
- Last successfully applied signature and label persist. After reload, the UI restores that local history and explicitly says Windows state is unverified. With no stored history, it shows `Applied: unknown`. Editing adds the changed-since message; a failed Apply preserves the last successful record.
- Back to presets keeps dirty work visible in an Unsaved draft row. Resume restores the editor; Discard requires confirmation and keeps saved presets. The journey covers refresh, cancel and confirm.
- Static hosting explains that a local Windows run is needed. Missing local config and permission-probe failure have separate messages. A failed probe disables Apply. The existing probe writes and deletes a temporary file, leaving the active config and EQ file alone.
- The Settings switch now describes its actual operation: enabling/disabling the APO managed include. It does not enable apply-on-save. Successful Apply updates the stored include-enabled flag because the bridge installs that include.
- First Apply for a config path now asks for confirmation: it explains the include line, backup, sibling file and system-audio effect. Cancel makes no sync request. A successful Apply remembers consent for that path; failure does not.
- The save dialog traps Tab/Shift+Tab, restores focus on dismissal, exposes its help text to assistive technology, gives every form control a 44px minimum height, and scrolls in short viewports. Further accessibility work remains outside this focused follow-up.

## Evidence

Evidence is generated locally by `npm run test:all` under ignored `artifacts/step3/`. The final release suite output, four inspected screenshots and excluded Step 4 diff are also tracked under [verification/step3-release](verification/step3-release/README.md), so those primary evidence links work in a clone. Auxiliary audit links into `artifacts/` refer only to this local checkout.

| Evidence | Local file |
| --- | --- |
| Raw final release suite output, including every command and exit status | [full-suite.txt](verification/step3-release/full-suite.txt) |
| Raw live-model output | [models.log](../artifacts/step3/models.log) |
| Focused Save/Apply fetch-spy and recovery output | [save-apply.log](../artifacts/step3/save-apply.log) |
| All seven test diffs, from Step 3's parent `b6d5157` through the finished files | [seven-test-diffs.patch](../artifacts/step3/seven-test-diffs.patch) |
| Complete client diff, from the same parent | [apoBridgeClient.patch](../artifacts/step3/apoBridgeClient.patch) |
| Complete Step 3 component/client diff | [step3-complete-code.patch](../artifacts/step3/step3-complete-code.patch) |
| Fixtures compared with original Step 2 commit `372b1be` | [fixture-diff-from-step2.patch](../artifacts/step3/fixture-diff-from-step2.patch) |
| Byte comparisons and SHA-256 checks of original fixture material | [fixture-integrity.txt](../artifacts/step3/fixture-integrity.txt) |
| Server file identity, including localhost, Host and Origin checks | [server-integrity.txt](../artifacts/step3/server-integrity.txt) |
| Expected regression failure with exact pre-fix GraphLab from `aadaa91` | [sample-rate-before.log](../artifacts/step3/sample-rate-before.log) |
| Passing equivalent test against current GraphLab | [sample-rate-after.log](../artifacts/step3/sample-rate-after.log) |

The pre-fix component reports `{draftSampleRate:48000,fitSampleRate:48000}` and fails the assertion requiring 96000 (exit 1). The current component reports 96000 for both and passes (exit 0). The regression test serves a temporary exact Git copy through Vite; it does not overwrite the working GraphLab file and removes the temporary copy afterward.

| Visually opened and checked | 1920px | 390px |
| --- | --- | --- |
| Save dialog | [Desktop](verification/step3-release/save-preset-dialog-1920.png) | [Phone](verification/step3-release/save-preset-dialog-390.png) |
| Disabled Apply on built static preview | [Desktop](verification/step3-release/disabled-apply-windows-1920.png) | [Phone](verification/step3-release/disabled-apply-windows-390.png) |

The dialog is also checked at 320px. The screenshots show contained controls and readable instructions without page overflow. The disabled-Apply screenshots show the reason beside the button and `Applied: unknown`.

## What the verification covers

`test:all` runs typecheck, build, core, APO, retrieval, UI, DSP, mobile, workspace, Lab, graph, mobile-EQ, production, Save/Apply and Lab sample-rate checks. The runner starts the dev and built-preview servers and records explicit exit codes. All seven reviewed browser files have package scripts: `test:ui`, `test:mobile`, `test:production`, `test:lab`, `test:workspace`, `test:graph`, `test:mobile-eq`. No checked-in CI configuration was found; the evidence here is a fresh local run, not an inference from edited tests.

Review of the seven diffs found no loosened assertions. Dialog-opening/filling/submission steps replace the former inline-name workflow. Name equality checks now inspect the displayed active preset name where the inline input was removed. Existing source-link, filter, headroom, save/copy, refresh, Undo, drag, overflow and error checks remain, with additional Save/Apply assertions. The four secondary browser scripts also use the cross-platform browser launcher.

The independent browser DSP check covers 4,842 response cases and six rendered cases. APO server tests use temporary config files. UI Apply uses intercepted requests; this is not a physical Windows APO listening test. The live provider test verified catalog presence and a direct HTTP 404-to-200 fallback, while its streaming fallback attempt reached an account quota response. Its exit-0 result does not establish that all live provider features have available quota.

## Fixture audit and plan corrections

The earlier generator run changed all three `generatedFromCommit` headers from the original `aadaa91` value to `f934c20`. This follow-up restores the original headers and corresponding strict test expectations. Relative to `372b1be`, the complete storage and backup files are now byte-identical. The original three share cases and their header are byte-identical; the only share-file diff is the two appended automated browser cases (999 inserted lines). No fixture generator was rerun to manufacture these results. The generator now writes candidates to `artifacts/fixture-candidates/` and records the checkout commit instead of overwriting goldens.

Those two appended browser captures are synthetic coverage. Their IDs now start with `automated-browser`, and their descriptions explicitly say automated. Only appended entries were renamed; the original three cases and header remain byte-identical. No historical link actually sent/opened by the user or friend was supplied, so that compatibility evidence remains missing. Share tests compare decode output directly; no draft adapter is used for them.

The [tracked Studio plan](STUDIO_MERGE_PLAN.md) supersedes the stale external plan. It keeps the displayed target and fitted target distinct, names future fit/display smoothing fields separately, limits legacy adapters to storage/backup fixtures, and bases handle eligibility on actual unshifted filter coordinates. GraphLab's rawFilter label alone does not suffice: measured curves are normalized acoustic responses, and filter offsets, inversion, smoothing, baseline and delta transforms matter.

The original history contained Step 1 (`f934c20`), Step 2 (`372b1be`, `b6d5157`), Step 3 (`84371b8`), the unapproved Step 4 fit-limits change (`8b6669b`), then the Step 3 follow-up (`392bd71`). The release branch cherry-picks only the five requested Step 1–3 commits. Its GraphLab is byte-identical to `84371b8`; `8b6669b` is not an ancestor. The [excluded diff](verification/step3-release/8b6669b.patch) is tracked for review. No store merge, Studio extraction or route consolidation has occurred. Step 4 stays on hold until the friend test is done.

## Reproduction and remaining review

Run `npm run test:all` for the complete local suite and screenshots, and `npm run test:models` for live account checks. Run `node tests/lab-sample-rate.cjs --legacy` for the expected pre-fix failure. It exits 1 deliberately. Do not edit source while browser verification is running, because Vite hot reload can interrupt a test.

Merge and deployment remain gated on historical share capture and the real Windows Apply/listening test. Desktop automation stopped because its runtime could not determine Chrome's current URL with sufficient confidence; no further desktop input was attempted. Consequently, browser history was not searched and a deployed Share graph URL was not captured. No historical links or friend feedback have been invented.

The installed config was found at `C:\Program Files\EqualizerAPO\config\config.txt` (the directory name has no space), containing only `Include: peace.txt`. It was copied to ignored `artifacts/step3/real-apo-before-2026-11-02T07-33-00-165Z/config.txt`. A real read-only `/api/apo/status` request reported `connected: true`, `exists: true`, `includeExists: false`, `hasManagedInclude: false`, and `hasBackup: false`. After all tests, its SHA-256 was still `ac45311bf0349ece7e2372a79dca40e2515456066f468b27c6a6282cad2fbf9e`; neither AudioSage's EQ file nor bridge backup existed. This is a readiness check, not an Apply/listening result: no real EQ was applied, no file-mtime Save test was performed against those physical files, and no audible change was verified.

All Step 4 work remains on hold until the friend test on the eventual approved deployed build is complete. The optional CI addition is deferred.
