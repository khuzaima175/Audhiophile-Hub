> Historical snapshot: the 2026-10-07 mobile graph, Squig workflow and stereo EQ follow-up is described in [the current Graph Lab guide](../GRAPH_LAB_GUIDE.md). This archived body remains unchanged.

> Historical snapshot retained for traceability. Marked superseded on 2026-10-07. Model IDs, theme descriptions and test claims below describe earlier work and are not current product guidance. See [the current document](../../VERIFICATION_REPORT.md), [current UI](../../UI_REDESIGN.md) and [manual testing](../MANUAL_TESTING.md).

# AudioSage verification — 7 October 2026

## What was verified

| Check                                                                                                                  | Result                                                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript and production build                                                                                        | Pass                                                                                                                                                                            |
| Desktop workflows, data restore, chat composition, EQ import/save/reset, graph import/zoom/export/sharing              | Pass in Microsoft Edge                                                                                                                                                          |
| Mobile PEQ editing and graph controls                                                                                  | Pass in Chromium and WebKit at 320×640, 390×844, 568×320, and 768×1024                                                                                                          |
| Touch graph crosshair                                                                                                  | Pass in both browser engines                                                                                                                                                    |
| DSP against independent browser filters                                                                                | 4,842 frequency comparisons across 44.1, 48 and 96 kHz; maximum absolute difference 0.000005715 dB, excluding exact notch nulls                                                 |
| Filter anchors, boost/cut cancellation, zero-gain pass/notch filters, overlapping-filter headroom, graphic filter bank | Pass                                                                                                                                                                            |
| Automatic PEQ                                                                                                          | Synthetic known-filter recovery reduces RMS error; generated response and residual agree; filter limits, overlap and normalization tested                                       |
| Measurement parsing                                                                                                    | REW phase columns, explicit L/R columns, duplicates, unsorted rows, non-finite values and supported frequency range tested                                                      |
| Equalizer APO bridge                                                                                                   | Non-destructive permission probe, original-file backup, repeated sync, managed-line removal and preservation of independently managed includes tested using disposable fixtures |
| Bridge request restrictions                                                                                            | Non-local clients, untrusted hosts, cross-origin requests, wrong content type and malformed JSON rejected                                                                       |
| Graph Lab & datum normalization                                                                        | Squig.link 1 kHz datum alignment across all curves, Fritsch-Carlson monotonic Hermite clamping, target-isolated solo mode with focused Y bounds, and inverted post-EQ residual delta error vs target verified |
| Settings & workbench tab retention                                                                    | Switching/editing gear items, listener facts, or custom EQ profiles preserves the active tab and prevents unwanted jumping to the listener profile                              |
| Gemini multi-model tier                                                                                | Primary reasoning runs on `gemini-3.8-flash` with automatic fallback to `gemini-3.7-flash` and `gemini-3.5-flash-lite`; live minimal connection test passed with HTTP 200        |
| npm dependency audit                                                                                                   | Zero reported vulnerabilities after migration to Tailwind 4                                                                                                                     |

## Accuracy corrections

The original graph used approximate bell/shelf shapes and a graphic spline, while playback used real cascaded filters. A shared RBJ biquad implementation now drives the plotted response, automatic fitting, headroom calculation and playback. Shelf Q uses browser IIR filters; pass-filter Q is converted to Web Audio's dB convention. High-pass, low-pass and notch filters remain active even with zero gain. The app's playback and workbench model use 48 kHz.

Measured curves and targets share the normalization datum. The post-EQ plot uses measured response plus EQ; it no longer adds EQ to an unrelated target and calls that the measured result. Graphic slider values are filter parameters: overlapping filters sum, so a slider value is not a guaranteed final response at that frequency. Wavelet exports sample the actual response onto its documented import grid and include headroom in the exported gains. Imported GraphicEQ files are approximated with parametric filters, with the residual RMS shown to the user.

Curves in Graph Lab follow squig.link datum conventions with 1000 Hz / 0.0 dB alignment, eliminating floating vertical offsets in reconstructed IEM responses. Sparse graphic equalizer interpolation uses monotonic cubic Hermite splines with Fritsch-Carlson tangent clamping to eliminate overshoot between adjacent sliders. Solo view isolates individual curves against target baselines with dynamically focused Y-axis bounds, while inverted post-EQ mode plots the true residual delta error directly relative to the active target.

The former match percentage included an arbitrary bonus. It now reports RMS improvement rather than a claim about acoustic fidelity. Fitting stays within the supplied measurement support. Reference targets and measurements must come from compatible measurement rigs to support meaningful acoustic comparisons.

## Important limits

These tests verify software behavior and digital magnitude-response calculations. They do not certify the accuracy of an uploaded measurement, a headphone's actual sound, phase/group delay, distortion, transducer limits, or a particular listener's preference.

The bundled IEF-style, Harman-style and HD600-style curves lack independently verified numerical provenance. They are now labeled approximations. AI-generated charts are identified as unverified estimates, and research prompts no longer require invented numerical curves. A response reconstructed from a correction and an assumed target is explicitly inferred, not measured.

Wavelet conversion and automatic PEQ fitting are approximations. The greedy fitter is not a global optimizer and cannot guarantee a particular error on every headphone. Dense sampling plus filter-center checks and 0.2 dB margin provide practical headroom, not an absolute guarantee against every possible time-domain overload or intersample peak. Shared graph links may round/downsample curve data.

WebKit tests are browser-engine simulations, not tests on a physical iPhone. Microphone recording and browser tab capture still depend on device permissions and browser support. APO file handling was verified in disposable fixtures; a real system audio installation was not modified during testing. The local bridge is part of the development server and is unavailable on a static-only deployment. AI access remains subject to the configured account's quota and model availability.

Tailwind 4 requires modern browsers: Safari 16.4+, Chrome 111+, or Firefox 128+.

## Reproduce

```sh
npm ci
npm run dev
# In another terminal:
npm run typecheck
npm run build
npm run test:core
npm run test:apo
npm run test:dsp
npm run test:ui
node node_modules/playwright/cli.js install webkit
npm run test:mobile
```

The optional `node tests/live-api.cjs` check makes one live Gemini connection request using an environment key. It does not print the key. Automated UI checks use isolated browser storage and block AI requests.

## Primary references

- [W3C Audio EQ Cookbook](https://www.w3.org/TR/audio-eq-cookbook/) — digital biquad coefficients and Q conventions.
- [W3C Web Audio specification](https://www.w3.org/TR/webaudio/#BiquadFilterNode) — native filter behavior and independent frequency-response API.
- [Equalizer APO configuration reference](https://sourceforge.net/p/equalizerapo/wiki/Configuration%20reference/) — filter types, Q support and GraphicEQ interpolation.
- [Wavelet import documentation](https://pittvandewitt.github.io/Wavelet/Import/) — required frequency grid and normalization.
- [AutoEq project](https://github.com/jaakkopasanen/AutoEq) — measurement-based EQ and optimization limitations.
- [Crinacle's IEF target explanation](https://crinacle.com/2025/02/05/the-new-2025-ief-target/) — preference targets are not universal acoustic truth.
- [Google Gemini API Models](https://ai.google.dev/gemini-api/docs/models) — primary reasoning upgraded to Gemini 3.8 Flash with automatic fallback to Gemini 3.7 Flash and Gemini 3.5 Flash-Lite.
- [Tailwind upgrade guide](https://tailwindcss.com/docs/upgrade-guide) — PostCSS migration and modern browser requirements.
