# Graph Lab, mobile EQ and Squig workflows

Updated 2026-10-07. This follow-up fixes the phone screenshot's overlapping frequency labels and expands the existing shared AudioSage workspace. It does not replace the user's Gemini 3.8 Flash → 3.7 Flash → 3.5 Flash-Lite priority.

## What changed

Both comparison and EQ SVGs use the measured container size. Frequency labels reserve space in CSS pixels and are omitted when adjacent labels would collide, including in zoomed views. The selected-band panel sits below the phone graph instead of covering its frequency axis. Desktop retains the full-size canvas and side panels. Graph handles keep 44-pixel touch hit areas.

Use **New EQ preset** to start a manual parametric preset. Drag numbered handles; tap **Add band on graph**, then tap the plot to place another band. Desktop double-click also places bands. Frequency, filter type, gain, Q and Enabled share the same editor state. Graphic EQ keeps fixed frequencies and exposes a selected-band gain control. Arrow keys adjust frequency/gain, Shift increases the step, Page Up/Down changes Q, and Delete removes a parametric band. Ctrl/Cmd-Z and Redo shortcuts work outside text inputs. Pointer cancellation restores the starting parameters; a completed drag is one Undo entry.

**Graph controls** offers bass/mids/treble or custom frequency limits, auto/manual dB scaling, inspection and curve labels. **AutoEQ limits** independently sets fit frequencies, gain, Q and allowed peak/shelf types. Limits are validated before applying. Display zoom, offsets, baseline and visibility do not change original fitting data. The editor supports 1–20 automatic filters.

[Verified mobile EQ screenshot](images/mobile-eq.png) shows the spaced frequency axis after touch editing. Scroll the surrounding editor to reach the panel below the chart.

## Compare and import

Import multiple frequency/dB text, CSV, TSV or REW files. A third phase column remains phase data. Explicit Left/Right column headers preserve both channels. Separate files with matching `Model L.txt` and `Model R.txt` names are paired when imported in the same session; a single channel stays single until its opposite is supplied. Stored pairs survive refresh. L/R averages use linear amplitude, converted back to dB, over their common measured frequency support.

Curve Options provides color, pinning, rig metadata, L/R/average/both selection, inversion, target difference, Solo, baseline and original CSV. A channel-difference readout reports RMS over common support in 100 Hz–10 kHz. Pins protect curves from Clear unpinned and automatic recoloring. Search filters the local curve list. Average visible creates an explicitly labeled derived acoustic average; EQ correction curves and targets are excluded. Different recorded rigs are identified in the comparison view.

Advanced controls choose frequency normalization, a log-frequency mean level, or original levels. L/R frequency alignment uses a common average datum so channel differences remain visible. Baseline subtracts a chosen displayed curve within common support, after its display transformations. Inspection orders readouts by proximity to the pointer; tapping chooses the closest curve. Displayed CSV includes normalization/baseline metadata. Original CSV retains original curve values. PNG/SVG exports capture the visible plot with wrapped captions; shared links retain view settings, baseline, pins, channel data and custom targets. Shared curves are downsampled to keep links smaller; use complete backups for exact source arrays.

## Squig catalog and custom targets

Open **Browse Squig measurements**, enter a public `phone_book.json` URL and load it. Search accepts abbreviated model/variant tokens; choose a brand to narrow results. The adapter supports string phones, explicit file names, file arrays, prefixes and suffix variants. It defaults to the catalog's directory; change Measurement directory URL if that server stores text elsewhere. Measurements use the documented `basename L.txt` / `basename R.txt` convention. One missing channel produces a visible notice and preserves the available channel. Servers with other conventions can be used through local file import.

Remote servers must permit browser CORS. Timeouts, unavailable channels, invalid catalogs and HTTP failures are shown. AudioSage does not bundle or mirror Squig's headphone database. Catalog verification uses controlled browser fixtures; actual access to every public server is not established.

**Import target** in comparison or **Import custom target** in the editor accepts numeric acoustic target data. Imported targets remain selectable alongside bundled targets. Source and custom target records are linked to saved presets in IndexedDB and included in full backups. A missing linked target blocks fitting rather than silently using a different target. A shared target can be saved locally when starting EQ from the shared graph. Check target/measurement rig compatibility; bundled target approximations retain their existing unverified-provenance labels.

## Stereo EQ and listening

Enable **Independent left / right EQ** in a parametric editor. Choose the editing channel; each bank has its own filters, graph handles and AutoEQ action. Copy bank to other channel explicitly duplicates it. The plot and Wavelet export follow the selected bank. Playback applies both banks independently, upmixing mono input to both channels. Stereo measurement fitting uses a common average normalization datum. Protective preamp covers the stronger channel. Save, copy, Undo, reload and backups preserve both banks. Clear source removes the persisted measurement link while keeping editable filters.

APO text establishes a global preamp and exports separate L/R sections and resets to `Channel: ALL` afterward. Import preserves generated L/R sections; unsupported channel routing is rejected rather than collapsed into a single bank. The local bridge accepts these generated channel commands. Wavelet remains a single response format, so its export represents the selected bank.

Listen using a local track, pink noise, sweep, an adjustable logarithmic test tone or supported browser tab capture. Comparison has volume, Stop and A/B controls. Changing comparison source/channel/fit settings stops playback and clears the previous comparison filters. Existing playback ownership, effective attenuation and browser capture restrictions remain in effect.

## Research and differences from Squig

Primary sources reviewed:

- [Squig's official lab repository](https://github.com/squiglink/lab): graph and comparison interaction inventory.
- [Graph documentation](https://github.com/squiglink/lab/blob/main/Documentation.md): logarithmic interpolation, averaging, normalization and baseline semantics.
- [Configuration documentation](https://github.com/squiglink/lab/blob/main/Configuring.md): catalog and measurement filename format.
- [Squig](https://squig.link/): public measurement/EQ workflow.

| Workflow | AudioSage implementation / difference |
|---|---|
| Responsive comparison, zoom, scaling, inspection | Both comparison and manual EQ, collision-aware mobile axes |
| Search, variants, L/R, average, imbalance | Public catalog adapter plus local search; imbalance uses documented RMS, not Squig's detection algorithm |
| Hide, Solo, pin, offset, color, baseline | Per-curve controls; pins protect clearing/recoloring |
| Averaging and normalization | Linear-amplitude averages; frequency, original-level and log-frequency mean alignment |
| Smoothing | Raw and 1/48, 1/24, 1/12, 1/6, 1/3 fractional-octave averaging; Squig's spline smoothing is different |
| Perceived loudness alignment | Mean alignment is labeled as a mean; it does not implement Squig's ISO-226/free-field/pink-noise weighting |
| Manual EQ, constrained AutoEQ, stereo | Editable peak/shelf/pass/notch bands; peak/shelf automatic fitting; independent stereo banks |
| Audition and exports | Local tracks/noise/sweep/tone/tab capture, A/B; APO, Wavelet, CSV, PNG, SVG and sharing |
| Measurement hosting and community variants | Uses public compatible sources or local imports; no claim of access to all datasets, custom fork features or exact UI parity |

Automated tests establish the implemented workflows, not exact equivalence with every Squig fork. Physical-device listening, Safari/WebKit, real Windows APO and live public measurement-server compatibility still require manual checks. See [verification](../VERIFICATION_REPORT.md) and [manual testing](MANUAL_TESTING.md).
