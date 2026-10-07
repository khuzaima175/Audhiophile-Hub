# AudioSage

AudioSage is a browser workspace for researching audio gear, manually editing EQ, fitting corrections to numeric measurements, comparing curves, and keeping presets and listening preferences locally.

## Current workspace

The implemented workspace adds a persistent shared EQ draft with linked measurements, direct graph editing and grouped Undo, separate fitting/display settings, consistent preamp/rate/export policy, ranked local retrieval and version-3 backup recovery. The UI uses a near-black theme with three starting workflows; desktop curve/band panels sit beside graphs and mobile panels stack or expand.

For hands-on testing after pulling from GitHub, follow [the manual testing guide](docs/MANUAL_TESTING.md). It covers setup, measurement fixtures, saving/refresh, audio, live research, recovery and production preview. Automated results are evidence for the tested environment, not a guarantee that every account/device works identically.

## Graph Lab and mobile EQ update

Phone graph axes now omit overlapping labels, and the selected-band panel leaves the frequency axis visible. Graph Lab adds custom zoom/dB scales, inspection, pins/colors/rigs, baselines, amplitude averaging, L/R comparison, multiple-file imports, a searchable Squig catalog adapter, custom targets, PNG/SVG exports and richer sharing. Manual EQ adds tap-to-place bands, type/Q editing, shortcuts, constrained AutoEQ and independent stereo banks with stereo APO export. Presets and backups preserve both banks and linked custom targets.

Read [the Graph Lab guide](docs/GRAPH_LAB_GUIDE.md) for steps, source research and explicit differences from Squig. Public catalog access depends on each server's CORS/data conventions; mean-level alignment and fractional-octave smoothing use their labeled AudioSage algorithms.

## Run locally

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3000. Node 20+ is recommended. TypeScript, Vite, React 19 and Tailwind 4 power the app. Tailwind's explicit configuration is retained.

For hosted research, enter your personal Gemini key in Settings & data. It remains in this browser's localStorage and is excluded from backups. Local development also accepts `GEMINI_API_KEY` or `VITE_GEMINI_API_KEY` in `.env.local`; both are excluded from production assets. Do not embed shared credentials into a hosted app. Shared-key hosting would require a protected service with access and usage limits; this project currently uses personal-key mode.

The centralized catalog uses this default priority: Gemini 3.8 Flash → Gemini 3.7 Flash → Gemini 3.5 Flash-Lite. Availability depends on the account and API. Test Connection runs the streaming request with grounding used by research; it does not claim broad account/model availability. Credential, model, quota, request and network failures are distinguished. Only unavailable-model errors trigger research fallback. The model selector remains the requested model; each new response records the answering model.

## Audio workflow

Choose Manual EQ or Measurement-based EQ on Overview, or open Equalizer. Editor, Compare and Presets work with one persistent version-2 draft. Graph Lab includes Compare curves, Edit EQ and Presets views. Its New EQ preset action creates an editable parametric band; you can drag/edit, assign gear, save/copy and export without leaving the tab. Correction generation stays in Graph Lab. The comparison plot fills its container, and desktop/mobile editor panels use the same draft and preset library as Equalizer; existing navigation entries remain available.

For measurement correction, import numeric CSV/TSV/REW data, choose a target and fitting smoothing, then edit the generated filters. Bundled acoustic targets are approximations with unverified numerical provenance; choose a target compatible with the measurement rig. A curve inferred from an assumed target minus a correction is an inference, not a measured headphone response. Generate correction requires measured source data. Reference targets can start manual EQ.

Numbered graph handles edit correction parameters using logarithmic frequency and gain dragging. Graphic bands have fixed frequencies. Arrow keys edit the selected band; Shift makes larger changes. Numeric controls use the same draft. Escape or a canceled pointer gesture restores its start; a completed drag is one Undo entry. Undo/Redo retains up to 60 changes. Shelves use Q-aware IIR playback; pass and notch filters do not expose an effective gain control.

Save updates the open preset and keeps the draft. Save as copy creates a new identity. Assign a stable gear record or custom hardware name. Source measurements are deduplicated by SHA-256 reference and stored in IndexedDB; arrays are excluded from the small localStorage draft. Drafts and linked sources survive navigation and refresh. Dirty replacement requires an explicit choice. Legacy presets are adapted on open without modifying original data until successfully saved.

## DSP, levels and exports

The shared biquad implementation drives plotting, fitting and playback. Automatic headroom uses response-based attenuation. Manual mode preserves requested preamp separately and applies protective attenuation when needed; the UI shows both. This is not a true-peak limiter and does not guarantee every signal cannot clip.

Choose an intended rate of 44.1, 48 or 96 kHz before starting preview. Playback uses the actual AudioContext rate, which becomes the plot/fitting assumption. Response points stay below Nyquist. External players should use the exported rate assumption or evaluate the response at their rate.

Correction view shows response shape; post-EQ view can include effective attenuation or show shape without preamp. Current post-EQ response uses the current filters. Original automatic-fit settings/results remain separately labeled. Display offset, Solo, inversion, and graph difference views do not change source-based fitting. Invalid/disjoint/empty fitting ranges fail visibly. Fitting sorts frequencies and averages duplicates; 1 kHz normalization requires overlapping support at that datum.

Raw bypass uses unprocessed audio. Optional file level matching compares all-channel RMS over the first ten seconds, attenuates the dry comparison by up to 24 dB, and recalculates when source/filters change. Silence, unavailable metrics or unsupported sources show a raw-bypass fallback. It is not a loudness or true-peak measurement. Only one workspace playback owner is active; source changes stop the previous owner and release capture.

APO text preserves supported parameter semantics and effective preamp. Wavelet is a sampled approximation on its 127-frequency import grid. GraphicEQ-to-PEQ fitting is also approximate. Conversion audits compare absolute response including preamp on the 180-point synthesis grid, with acceptance of ≤1 dB RMS and ≤3 dB maximum. Deep values are floored at −60 dB and explicitly flagged; deep notches and narrow features may exceed tolerance. Review flagged conversions in the destination player. Original and displayed graph CSV exports are separate; displayed exports include transformation metadata.

Equalizer APO integration is local: the development-server bridge edits managed includes with backups. Static hosting offers export instructions and has no Windows bridge. Real Windows integration must be verified on that system before release claims.

## Research and local retrieval

Current-conversation history is separate from optional older-conversation retrieval. Older retrieval is off by default. Local BM25 indexes matching passages, generated summaries and preferences using exact tokens that preserve FR, Q, DD, BA and product identifiers. It supplies relevant records within a configurable character budget (6,000 by default), deduplicates content and labels provenance. Each answer saves Context supplied metadata. Sources cited lists only web sources supported by API grounding indices; supplied context can be unused.

Research notes can be edited, pinned, disabled or deleted. Conversation retrieval can be disabled independently. Indexes rebuild on each request. Generated summaries require matching source revisions; legacy summaries with unknown coverage and changed-source summaries are excluded until regenerated. Generated summaries are not verified technical claims. Preferences are user data. Retrieved text is quoted and treated as untrusted source data; this is not a guarantee against prompt injection. No external embeddings are used.

Profile sliders save preferences. Use Create EQ draft explicitly to turn them into audio parameters.

## Backup and recovery

Settings & data exports version-3 backups containing profile, chats, notes, draft, all stored measurements, comparison state and retrieval settings. Keys are excluded. Legacy backups without a version and versions 1/2 are accepted as legacy profile/chat/note backups. Unknown versions, invalid modes/numbers and duplicate IDs are rejected. Missing source/gear links require choosing manual/unlinked recovery or canceling to find a complete backup.

Restore validates first, stages originals and structured records in IndexedDB recovery storage, and retains old measurement records. Failed writes attempt rollback and retain recovery data. Complete exports include preserved restore recovery data. Quota failures retain the draft in memory and offer retry; export before refreshing. Unsupported/damaged drafts remain untouched and can be preserved as recovery data before starting fresh. Browser data is device-local; clearing site data removes it.

## Verification

```sh
npm run typecheck
npm run build
npm run test:core
npm run test:apo
npm run test:retrieval
# with npm run dev running:
npm run test:dsp
npm run test:ui
npm run test:workspace
npm run test:lab
npm run test:mobile
npm run test:graph
npm run test:mobile-eq
# with npm run build and npm run preview -- --host 127.0.0.1 --port 3001:
npm run test:production
```

Browser tests use `/usr/bin/chromium` or `PLAYWRIGHT_BROWSER_PATH`. `TEST_WEBKIT=1` additionally runs installed WebKit in the mobile suite. AI requests in automated browser checks are blocked or mocked; no real key is needed. See [verification report](VERIFICATION_REPORT.md) and [milestone evidence](docs/IMPLEMENTATION_EVIDENCE.md). Earlier documentation is archived for traceability and is not current product guidance. Deployment remains a separate release step.

## Documentation map

| Document | Purpose |
|---|---|
| [Graph Lab guide](docs/GRAPH_LAB_GUIDE.md) | Mobile graph fixes, comparison/catalog workflows, stereo EQ and Squig feature coverage |
| [UI_REDESIGN.md](UI_REDESIGN.md) | Current navigation, black theme, controls, layouts and interaction semantics |
| [Implementaion_plan.md](Implementaion_plan.md) | Compatibility entry point with completed milestones and commit references |
| [Implementation plan](docs/IMPLEMENTATION_PLAN.md) | Original eight-milestone requirements with current delivery status |
| [Implementation evidence](docs/IMPLEMENTATION_EVIDENCE.md) | Per-milestone behavior and verification evidence |
| [Verification report](VERIFICATION_REPORT.md) | Passed automated checks and explicit unrun release checks |
| [Manual testing guide](docs/MANUAL_TESTING.md) | Reproducible local and physical/account test journeys |
| [Archived README](docs/archive/README-before-workspace.md) / [archived verification](docs/archive/VERIFICATION-before-workspace.md) | Historical snapshots; superseded by current documentation |
