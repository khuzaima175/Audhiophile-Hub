# AudioSage verification report

Updated 2026-10-07 for implementation through `868c97d`. Documentation-only follow-up does not change the recorded test outcomes. Use [the manual testing guide](docs/MANUAL_TESTING.md) for real-account/device checks and [the UI guide](UI_REDESIGN.md) for current interaction behavior.

Implementation base: `bc96299a4e51b889cbbfda55f991dc187bcecef9`. Original working tree was clean. The uploaded plan and milestone evidence are in `docs/`. Each milestone has its own commit. Deployment is separate.

## Automated evidence

| Check | Status | Evidence / limits |
|---|---|---|
| TypeScript | Passed | `npm run typecheck` |
| Production build | Passed | Vite build; lazy Settings/Graph/AI chunks |
| Core regression | Passed | DSP anchors, enabled filters, cascades, measurement parsing, source fitting, normalization, empty-overlap failure, sorting, preamp policy, APO round trips, Wavelet conversion audit |
| APO fixtures | Passed | Non-destructive probe, backup, idempotent sync, managed disable and input validation; disposable files only |
| Independent DSP response | Passed | 4,842 browser comparisons at 44.1/48/96 kHz; maximum error **0.000005715 dB** outside exact notch nulls |
| Rendered offline audio | Passed | Six rendered-tone cases at 44.1/48/96 kHz, including shelves, disabled filter and effective preamp; maximum level error **0.000002291 dB** |
| UI smoke | Passed | Navigation, composer, profile/gear persistence, EQ import/save/new draft, graph import/CSV, actual Web Audio filtering/bypass/cleanup, share metadata, backup restore, corrupt originals preserved |
| Workspace journeys | Passed | Measurement → fit → keyboard/drag/cancel/Undo → gear/save/copy → navigate/refresh/reopen; source link, filters and requested preamp retained |
| Recovery matrix | Passed | Legacy unversioned/1/2 backups and APO text presets; version-3 complete restore; invalid numbers/unknown versions/duplicates rejected; missing links require manual recovery; simulated quota/failed-restore rollback preserves originals and structured recovery |
| Portal / Escape | Passed | Desktop and phone viewport bounds, keyboard navigation, focus restoration, Advanced disclosure before graph dismissal, one surface dismissed per Escape |
| Mobile Chromium | Passed | Touch crosshair and editor creation at 320×640, 390×844, 568×320 and 768×1024; viewport overflow checks |
| Local retrieval fixture | Passed | Three intended passage hits versus zero for legacy trailing-message baseline; three negative/disabled queries return no context; dedup, budgets, short terms, current-chat separation, stale-source exclusion and adversarial quote framing |
| Production research | Passed with mocks | Personal browser key; actual SDK streaming/grounding request shape; unavailable-model fallback preserves requested selection; answering model/context metadata saved; only cited grounding sources shown; disabled note excluded from next request |
| Production persistence / integration | Passed | Manual EQ save/refresh/export and rate/preamp metadata; static deployment has no local APO bridge |
| Build-time key exclusion | Passed | Production build using distinct placeholder GEMINI/VITE keys contains neither placeholder; no actual key printed or copied |

All browser checks above use installed Chromium. The retrieval fixture is intentionally small and does not establish general relevance quality. Mocked research verifies request/error behavior, not real account authorization.

## Changes caught by verification

The cursor marker originally intercepted drag-handle pointer events; cursor overlays now ignore pointer events. View/selection changes originally dirtied the shared draft; only content changes now do. Hot reload could give test dynamic imports a second store instance; final journeys run from a clean server session. A BM25 score cutoff was too high for a one-record corpus; the labeled adversarial fixture caught this and the cutoff was corrected. Legacy selector assumptions were updated for explicit Save / Keep draft and independent display/fitting smoothing.

## Release checks still unrun

- Live Gemini availability, credential verification, quota and grounding authorization for an actual user account.
- Deployed public-asset inspection and any required credential rotation/revocation: no deployment URL or affected credential was provided. Local production exclusion is verified; historical deployed exposure is **unverified**.
- Edge and WebKit in this environment, physical mobile-device accessibility and listening, microphone/tab-capture permission flows, and real Windows Equalizer APO integration.
- The specific originally reported toast overlap; passive notifications are now pointer-transparent and accessible, but that exact report lacked reproduction details.
- Broad retrieval evaluation beyond the six-query fixture and adversarial model behavior beyond quote framing.

Release should wait for applicable live/deployed/physical checks and resolution of any confirmed credential exposure. No publication or external deployment was performed.

## Reproduce the checks

Run `npm ci`, then `npm run typecheck`, `npm run build`, `npm run test:core`, `npm run test:apo` and `npm run test:retrieval`. With the development server on port 3000, run `npm run test:dsp`, `npm run test:ui`, `npm run test:workspace` and `npm run test:mobile`. With the production build served using `npm run preview -- --host 127.0.0.1 --port 3001`, run `npm run test:production`.

Browser suites use `/usr/bin/chromium` by default; set `PLAYWRIGHT_BROWSER_PATH` to an installed Chromium-compatible executable on another machine. `TEST_WEBKIT=1` additionally requests installed WebKit for mobile checks; it was not run here. Production AI requests are mocked and development UI requests are blocked. Browser screenshots are ignored under `artifacts/`.

Manual results should record date, commit, browser/OS/device and the actual operation checked. Repository publication to GitHub is distinct from application deployment and does not establish live model availability or device compatibility.
