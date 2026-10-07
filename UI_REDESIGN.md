# AudioSage workspace redesign

The app now uses task-based navigation: Overview, Research assistant, My gear, Equalizer, Graph lab, Listening profile, Research notes, and Settings & data. The previous hardware dashboard and all-in-one settings modal have been replaced with a consistent charcoal-and-sage workspace.

## How the workflows fit together

| Area              | Purpose and features                                                                                                                                                                                                                                                                                  |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overview          | Explains the three main workflows, shows saved gear and presets, and resumes previous research. Starting a suggested question fills the composer so it can be reviewed before sending.                                                                                                                |
| Research          | Text, multiline input, image attachments, voice questions, technical analysis, streaming responses, citations, glossary definitions, embedded graphs, verification, copying, and saving notes.                                                                                                        |
| My gear           | Owned gear, wishlist and tested items, category/status dropdowns, rating, price, notes, search/filtering, and comparison of two or three items.                                                                                                                                                       |
| Equalizer         | 10-, 15-, and 31-band graphic EQ, parametric filters, measurement import, automatic target matching, preset editing, browser audio capture, local audio, pink noise, sweeps, bypass, playback volume, and APO/Wavelet exports. Advanced measurement, preview, and playback controls expand on demand. |
| Graph lab         | Measurement import, reference targets, functional bass/mids/treble zoom, smoothing, normalization, curve visibility, offsets, inversion, difference/solo views, comparison EQ audition, EQ creation, CSV export, and shared graph links.                                                              |
| Listening profile | Preferred sound, everyday gear, genres, sensitivities, additional notes, and tuning preferences. Profile fields save as they are edited.                                                                                                                                                              |
| Research notes    | Manually saved listening notes and searchable AI summaries of previous conversations.                                                                                                                                                                                                                 |
| Settings & data   | Gemini connection, optional Equalizer APO integration, full JSON backups, restore, and reset.                                                                                                                                                                                                         |

## Functional fixes included

- Pages start at their headings instead of inheriting the chat scroll position.
- Mobile navigation closes after selection; dialogs keep the workspace behind them out of keyboard focus.
- The composer supports Shift+Enter and avoids sending during IME composition or recording.
- Corrupt saved JSON no longer crashes startup or silently overwrites the original data.
- Backups are validated before restore and refresh conversations, notes, and the profile immediately. Backup export can preserve unreadable original sections for recovery.
- Graph zoom now changes the frequency mapping, ticks, cursor frequency, and plotted domain. Smoothing is applied to measured curves.
- Graph comparison EQ installs real audio filters; bypass keeps its separate dry signal path and preamp headroom.
- Changing filter topology rebuilds the audio chain. Volume changes update playback, and closing Graph lab releases audio resources.
- Browser capture initializes its audio context on demand, shows its capture prompt in both workspaces, and avoids restarting capture cleanup on each render.
- New EQ presets start clean. Loading a preset clears previous editor state. Typed frequency, gain, and Q values are bounded.
- Exported APO presets use their saved band layout, preserve disabled filters, and account for combined filter headroom. Parametric-to-Wavelet export samples the actual filter response. GraphicEQ exports avoid duplicate 20 Hz entries.
- Shared graphs preserve filter provenance, source target, inversion, visibility, view mode, and smoothing; restored graphs include their reference target.
- Fake online, latency, token, and verification status displays have been removed.
- Large tools load on demand; the AI SDK has its own production chunk. React type definitions and repeatable browser checks are now included.

## Verification

Start the local app with `npm run dev`, then run:

```sh
npm run typecheck
npm run build
npm run test:ui
```

The browser checks use installed Microsoft Edge and an isolated browser context. Set `AUDIOSAGE_TEST_URL` for another local server URL, or `PLAYWRIGHT_MODULE` for an externally bundled Playwright installation. Screenshots are saved under the ignored `artifacts/` directory.

The suite checks desktop and phone layouts, navigation, multiline composition, profile persistence, gear creation/filtering, notes, EQ import/save/reset, graph zoom/import/export, actual Web Audio filters/bypass/cleanup through a muted output, graph share metadata, backup restore and validation, command palette keyboard behavior, and corrupt saved-data recovery. AI requests are blocked during testing.

The subsequent accuracy audit, expanded mobile checks, live connection test, bridge hardening, and Tailwind 4 migration are documented in [VERIFICATION_REPORT.md](VERIFICATION_REPORT.md). The current dependency audit reports zero vulnerabilities. Physical device and acoustic measurement limitations are listed in that report.

The existing README edits were preserved.
