# Studio UI: one place to compare, edit and save EQ

Branch: `codex/studio-ui` (from `codex/release-steps-1-3`). Nothing here touches `main` or production.

## Problems (from the live preview)
- **Equalizer tab**: policy controls (normalize, attenuation, preamp mode, rate), five paragraphs of caveats, three collapsed panels and two button rows all appear before the first band slider. The graph is below the fold.
- **Graph Lab**: "Compare curves" and "Edit EQ" are separate panels, so editing hides the curves you are matching. Edit EQ re-mounts `EQWorkbench` (`embeddedInLab`) with its own duplicated toolbars.
- Both screens expose `EQWorkbench` and `GraphLab` as two parallel UIs over the same `audioWorkspace` draft.

## Design
One **Studio** layout, used by Graph Lab (the Equalizer tab opens the same view):

```
Header:  [preset name · Unsaved]            [Undo][Redo]  [Save preset…] [Apply to Windows ▾]
Main:    [ Graph (always visible, bands draggable) ]  |  [ Side panel: Bands / Curves / Target ]
Below:   [ Band strip: sliders or PEQ rows for the draft ]
Popover: Settings (level, preamp, sample rate, smoothing), Export (APO, Wavelet, txt, PNG, CSV, share)
```

1. **Graph stays on screen while editing.** Compare curves and the EQ draft draw on one plot. "Edit EQ" and "Compare curves" tabs go away; the side panel switches between *Curves* and *Bands*.
2. **Text moves behind `ⓘ`.** Each caveat becomes a one-line hint with an info popover. Level policy, preamp, rate and smoothing live in one Settings popover with plain labels.
3. **Two toolbars become one.** Primary actions only: Save preset, Apply to Windows, Undo/Redo. Copy APO, Copy Wavelet, Download, PNG, CSV and Share go in one Export menu.
4. **Presets** open as a drawer instead of replacing the page.
5. **Equalizer tab** shows the same Studio with the band sliders first and the graph directly below, so the first screen is the instrument.

## Constraints (unchanged behaviour)
- Save never syncs. Apply keeps its first-run confirmation, disabled-reason text and last-applied record.
- Draft fields, share links, backup/storage formats and golden fixtures stay byte-identical. This is a view-layer change.
- Fit-limits owner change (`8b6669b`) stays excluded.
- Touch targets 44px, 320px layouts, focus return and layered Escape keep working.

## Delivery in small commits
1. Extract toolbar, Export menu and Settings popover from `EQWorkbench` (no visual change).
2. Replace caveat text with info popovers; collapse policy controls into Settings.
3. Merge Compare and Edit into one Studio panel in `GraphLab`; Presets drawer.
4. Re-point the Equalizer tab to the Studio layout.
5. Update tests that rely on old panel names; run `npm run test:all`; capture 1920/390/320 screenshots.

## Verification
`npm run test:all` must stay green; screenshots reviewed at 1920, 390 and 320px; preview deployed from the branch for your review before any merge.
