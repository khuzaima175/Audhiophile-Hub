# AudioSage workspace UI

Updated 2026-10-07 for the implemented eight-milestone workspace plan. This document describes the current UI; [verification results](VERIFICATION_REPORT.md) distinguish tested behavior from checks still needing real accounts or devices.

## Navigation and starting workflows

Overview offers three entry points: Research, Manual EQ, and Measurement-based EQ. Existing sidebar entries remain available so saved gear, presets and conversations are easy to find. Pages reset their scroll position when opened. On phones, navigation opens as a drawer and closes after selection.

| Area | Current behavior |
|---|---|
| Overview | Start the three workflows, review saved gear/presets, or resume research. Suggested questions fill the composer for review before sending. |
| Research assistant | Multiline composition, attachments, voice questions, streaming answers, technical analysis, glossary and graph tools. Each new answer records requested/answering models and supplied context separately from cited web sources. |
| My gear | Stable gear identities, owned/wishlist/tested status, category, ratings, price, notes, search, filters and comparison. EQ presets can link to a gear record. |
| Equalizer | One persistent draft shared by Editor, Compare and Presets. Graphic and parametric EQ, linked measurements, source-based fitting, numbered graph handles, selected-band controls, Undo/Redo, preamp/rate policy, preview, Save and Save as copy. |
| Graph lab | Full-size comparison plot with a desktop curve sidebar and a collapsible mobile curve panel. Compare curves, Edit EQ and Presets views; New EQ preset, drag/numeric editing, gear assignment, Save/copy/export and measurement-based correction stay in the tab. Independent display/fitting settings and original/displayed CSV exports remain available. |
| Listening profile | Preferences save as edited. Create EQ draft explicitly turns tuning preferences into manual EQ parameters. |
| Research notes | Edit, pin, disable and delete notes; generate conversation summaries. Older-conversation retrieval is opt-in; summaries with stale or unknown source coverage are excluded until regenerated. |
| Settings & data | Personal Gemini connection and capability test, retrieval settings, local APO integration, complete version-3 backups, validated restore and preserved-workspace recovery. |

## Visual design and layout

The chassis uses semantic near-black, graphite, gray and soft-white tokens. Blue focus indicators and separate graph-series colors identify interaction and plotted data. The explicit Tailwind configuration remains loaded. Fader ticks and zero marks use the actual numeric ranges, including asymmetric ranges.

The comparison SVG measures its actual container rather than relying on a capped chart height or a fixed aspect ratio. Axis/cursor labels are larger and the curve Options trigger uses a compact visible label with a specific accessible name. On desktop, selected-band controls sit beside the EQ graph and the comparison curve list sits beside the Lab graph. Smaller screens stack controls and expose expandable panels. Primary mobile controls and graph handle hit areas target at least 44 CSS pixels. Reduced-motion preferences are respected.

## Graph editing and comparison

- Numbered handles select and edit correction filters. Parametric frequency dragging is logarithmic; graphic bands move vertically at fixed frequencies. Pass/notch filters omit gain edits that have no effect.
- Arrow keys edit the selected handle, with Shift for larger steps. Numeric inputs update the same draft. Pointer capture keeps the drag active outside the initial hit area; Escape or pointer cancellation restores the starting parameters. One completed drag creates one Undo entry, with history capped at 60 changes.
- Measurements and targets are read-only graph inputs. Generating correction requires measured data; reference targets can start manual EQ. Original-fit results remain labeled separately from the response of the current edited filters.
- Correction view shows EQ response shape. Current post-EQ can include effective attenuation or show shape. A target-minus-correction reconstruction is labeled as an inference, not a measured headphone response.
- Display smoothing, normalization, offsets, inversion, difference views and Solo do not modify source-based fitting inputs. Solo preserves the curve's saved visibility choice. Fitting has separate smoothing/normalization settings and visibly rejects unsupported or empty ranges.
- Original curve CSV preserves source values; displayed CSV and shared graphs include transformation and provenance metadata. Absolute post-EQ comparisons retain attenuation instead of normalizing it away.

## Surfaces, focus and feedback

Curve Options use portal popovers positioned within the viewport and updated during scroll/resize. Outside pointer dismissal, keyboard navigation and focus restoration are supported. Escape dismisses one active surface: a drag or popover takes priority; Advanced/composer/session disclosures close before their containing graph or page surface. Structural curve/band panels are not treated as transient menus.

Passive notifications occupy an accessible, pointer-transparent area. Damaged saved data, failed writes and missing restore links expose recovery choices rather than silently discarding the original. Save retains the open draft, Save as copy creates a separate identity, and replacing dirty work requires an explicit choice. View/selection changes do not mark audio parameters dirty.

## Research and audio status

The model catalog uses this default priority: Gemini 3.8 Flash → Gemini 3.7 Flash → Gemini 3.5 Flash-Lite. The selector displays the requested model; each answer records the model that actually answered. Only unavailable-model errors cause fallback. Connection testing checks the streaming/grounding request and distinguishes credential, model, quota, network and request failures. Actual availability depends on the user's account.

Context supplied identifies local records made available to an answer. Sources cited lists web sources supported by grounding references. Supplied records need not be used by the model. Retrieved passages are quoted as untrusted data; this does not establish prompt-injection immunity.

Audio controls distinguish requested preamp from effective protective attenuation, the intended rate from the active AudioContext rate, and raw bypass from optional file RMS matching. Matching uses the first ten seconds across channels with a 24 dB attenuation limit; it is not loudness or true-peak measurement. A single playback owner stops the previous source and releases capture when switching workspaces.

## Validation and manual testing

Automated Chromium checks cover desktop/mobile layouts, draft persistence, handle gestures, focus/Escape, source fitting, graph exports, backup/recovery and mocked production research. DSP checks compare browser responses and rendered tones at 44.1/48/96 kHz. Edge/WebKit, physical listening, live capture permissions, real Gemini authorization and Windows APO remain unrun here.

Use [the manual testing guide](docs/MANUAL_TESTING.md) after pulling the project. See [README](README.md) for setup and [the verification report](VERIFICATION_REPORT.md) for commands and evidence. Screenshots are generated under ignored `artifacts/`; dependencies, credentials and build outputs are excluded from Git.

## Graph Lab editor follow-up

The tab now exposes New EQ preset, Edit EQ and Presets alongside Compare curves. Creation starts with an editable parametric band. Name/gear/save/export controls and the graph appear before long numeric filter lists; level/rate/playback policy is expandable. Existing presets load into the shared draft for editing, saving or copying. Generate correction and Start manual EQ stay in Graph Lab instead of navigating away. Comparing an edited draft opens its current curves. The background settings/EQ page unmounts while Lab is open to avoid duplicate editors/audio engines.

A dedicated `npm run test:lab` journey checks desktop plot dimensions, Options bounds, pointer/keyboard editing, Undo/Redo, save/copy/reload/export, measurement links and mobile creation. Existing UI, workspace, mobile and mocked production suites were rerun successfully. Physical/device limitations remain those in the verification report.

## Mobile graph and Squig workflow follow-up

Comparison and EQ use the same collision-aware frequency label selection in measured CSS-pixel viewports. The phone's selected-band panel is in normal flow below the chart; it cannot obscure axis labels. Armed tap-to-place adds a band without requiring double-click. Numeric frequency/type/gain/Q/Enabled controls, Q/Delete keyboard edits, sorting, enable-all and Undo/Redo share the existing draft. Preset previews now reflect actual filters rather than a sample pattern.

Expandable graph/AutoEQ controls separate viewing from fitting. Local curve search, multi-file/channel pairing, pins/colors/rig metadata, baselines, derived averages, channel views and graph images are available in the comparison rail. The catalog browser searches compatible public Squig catalogs and exposes loading/missing-channel/CORS failures. Custom targets remain linked through presets/backups. Independent stereo selects one editing bank while both banks play; the UI explains the selected-bank Wavelet export and common headroom.

Test tone and local-track listening are available in comparison and EQ. Source and target uploads have distinct accessible names, as do comparison source/destination selectors. See [the Graph Lab guide](docs/GRAPH_LAB_GUIDE.md) for complete workflows and algorithm differences.
