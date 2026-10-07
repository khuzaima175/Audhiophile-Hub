# AudioSage manual testing guide

Updated 2026-10-07 for the shared audio workspace. Automated checks passed as recorded in [the verification report](../VERIFICATION_REPORT.md); this guide covers hands-on testing, especially account/device behavior that cannot be established by mocked browser tests.

## Get the current code

For an existing checkout, commit or stash your local edits before pulling:

```sh
git switch main
git pull --ff-only origin main
npm ci
npm run dev
```

For a new checkout:

```sh
git clone https://github.com/khuzaima175/Audhiophile-Hub.git
cd Audhiophile-Hub
npm ci
npm run dev
```

Use Node 20+ and open http://127.0.0.1:3000. No Gemini key is needed for manual EQ, measurement import, local graphs or backup testing. Keys and workspace data are local to the browser origin; port 3001 has different storage from port 3000. Export a backup before testing restores with data you want to retain. Backups exclude API keys.

## Manual EQ and saving

1. On Overview, start Manual EQ. Name the draft and add/adjust a parametric band. Select its numbered graph handle and compare the selected-band inputs with its plotted position.
2. Drag frequency/gain; press Escape during another drag and confirm that drag's starting values return. Complete a drag, then Undo and Redo: each completed drag should count as one change. Try Arrow keys and Shift+Arrow keys. Switch to graphic EQ and confirm fixed-frequency vertical editing.
3. Add a gear record under My gear, return to the draft and assign it. Set requested preamp and a rate assumption. Save; navigate away, refresh, reopen, and check the name, enabled filters, parameters, gear and requested preamp.
4. Save as copy and confirm an independent preset appears. Try replacing a dirty draft with another preset/import: a choice should appear before replacement. Changing only graph view or selected band should not make saved parameters dirty.
5. Export APO text and reimport it. Check preamp, filter enablement and supported frequency/gain/Q semantics. Inspect the rate comment. Wavelet and GraphicEQ conversions are approximations: review the conversion error/tolerance indicator rather than assuming identical parameters.

## Measurement correction and comparison

Create a UTF-8 file named `manual-measurement.csv` with this numeric test data. It is a synthetic fixture, not a measured product response:

```csv
Frequency,SPL
20,82
50,82
100,80
200,79
500,78
1000,80
2000,85
4000,81
8000,86
16000,76
20000,70
```

1. Start Measurement-based EQ, import the file, choose target and fitting settings, and generate/edit correction. Check that original-fit settings are recorded separately from the current edited response.
2. Edit a handle and inspect correction/current post-EQ views. Toggle shape versus effective attenuation. Save, refresh and reopen: source links and editable filters should survive.
3. Open the draft in Graph Lab. Confirm the measurement, current correction and current post-EQ are available. Change offsets, display smoothing, inversion and difference views; source-fitting settings should stay independent. Solo a curve and exit Solo; its prior visibility choice should remain.
4. Open Advanced, press Escape and confirm only Advanced closes. Open curve Options and use keyboard navigation/Escape; focus should return to its button and the graph remain open. A later Escape closes the graph.
5. Export original and displayed CSV. Original values should retain the source data; displayed CSV should record transformations. Share/reopen a graph and inspect its mode, target and provenance metadata.
6. Try a measurement range with no valid fitting evaluation points or no 1 kHz normalization support. Expect a visible failure, not a successful empty fit. Acoustic target compatibility and provenance need independent review for real measurements.

## Audio and physical-device checks

Start with comfortable output volume. Preview a local audio file, noise or sweep and compare processed audio with Raw bypass. Change the requested preamp and confirm the effective protection is shown separately. Optional file level matching uses all-channel RMS over the first ten seconds and has a 24 dB dry-attenuation limit; silence/unavailable metrics should visibly fall back to raw bypass.

Test intended 44.1/48/96 kHz assumptions and inspect the active AudioContext rate used by playback. Start playback in another workspace and check that the previous owner stops. Exercise browser/tab capture where the browser supports it, including permission denial, source switching and stream cleanup after closing the tool. Listen for changes/clicks and check device routing on your actual hardware. Response-based headroom is not a true-peak limiter.

APO bridge testing requires the local development server on Windows with Equalizer APO installed and a valid configuration path. Check managed include/backup behavior on that system. A static production preview or hosted site offers exports and has no local bridge.

## Live research and retrieval

1. In Settings & data, enter a personal Gemini key and use Test Connection. Confirm streaming/grounding capability succeeds for your account, or that the displayed failure accurately distinguishes credential, model, quota or network problems.
2. Confirm the default is Gemini 3.8 Flash and the other choices are Gemini 3.7 Flash and Gemini 3.5 Flash-Lite, in that priority order. Select a catalog model, add a distinctive research note, and ask a relevant question. Inspect Context supplied, the requested/answering model metadata and Sources cited. Supplied local context and cited web sources have different meanings.
3. Disable the note and ask again; it should be absent from the next answer's supplied context. Repeat after deleting/editing a note. Older-conversation retrieval starts off; enable it explicitly to test prior-session passages. Stale summaries should remain excluded until regenerated.
4. Adjust retrieval budget and check supplied-context metadata. Confirm current chat remains separate from older retrieved records. Test actual model availability/grounding; mocked automated responses do not establish these account capabilities.

## Backup and recovery

Export a version-3 complete backup. Change a draft/note, restore the backup and refresh; inspect profile, chats, notes, draft, measurement links, comparison session and retrieval settings. Exported files should exclude Gemini credentials.

Test legacy backups with disposable data. Unknown versions, duplicate IDs and invalid numeric/mode values should fail validation. Missing gear/source links should offer explicit manual/unlinked recovery or cancellation. Interrupted restore recovery should retain original records and offer Recover previous workspace. Automated fixtures simulate quota/write failures; to test browser quotas manually, use a disposable browser profile and export before refreshing unsaved in-memory changes.

## Responsive UI and production preview

Check desktop and phone widths, keyboard-only navigation, graph handles, selected-band panels, curve menus and notification positioning. Desktop panels should sit beside their graphs; smaller layouts should stack or expand without horizontal page overflow. Also test Edge, WebKit/Safari and a physical touch device; those were unavailable for the automated run here.

Build and run a separate static preview:

```sh
npm run typecheck
npm run build
npm run preview -- --host 127.0.0.1 --port 3001
```

Open http://127.0.0.1:3001. Enter the personal key again if testing research; origin-local settings from port 3000 are separate. Repeat save/refresh/export and lazy navigation. Confirm APO offers export guidance instead of a local bridge. Preview is local; it does not publish a website.

## Record issues

For each failure, record the Git commit (`git rev-parse --short HEAD`), browser/OS, viewport/device, reproduction steps, expected and actual result, and any non-sensitive console error. Include sample measurement/filter parameters where relevant. Do not include API keys or private backup contents. Add real-account/device results to [the verification report](../VERIFICATION_REPORT.md) with the environment and date rather than changing an unrun check to passed without evidence.
