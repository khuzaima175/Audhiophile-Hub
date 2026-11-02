# Step 3 release review evidence

Captured on 2026-11-02 for `codex/release-steps-1-3`. No merge, push or deployment occurred. The release starts at `main` (`aadaa91`) and cherry-picks only these original commits before the current confirmation/label/documentation follow-up:

| Original commit | Release cherry-pick | Scope |
| --- | --- | --- |
| `f934c20` | `9a34e63` | Sample-rate fix |
| `372b1be` | `456f752` | Original golden fixtures |
| `b6d5157` | `95386b2` | Additional synthetic share cases and assertions |
| `84371b8` | `61e6ea4` | Split Save and Apply |
| `392bd71` | `eaea5cc` | Step 3 review safeguards |

`8b6669b` is excluded and is not an ancestor of the release. The release's GraphLab file is byte-identical to `84371b8`. Its [exact excluded diff](8b6669b.patch) has five edits: fit limits for comparison audition, the audition-reset dependency, fit limits for correction fitting, limits carried into the new correction draft, and the fit-control binding. These are all held out of the release until Step 4 review.

The new first-Apply confirmation explains: “Adds one include line to config.txt, with a backup.” It also explains the sibling EQ file and system-audio effect. The tests cover cancellation without sync, subsequent acceptance, and persistence after success. The two appended JSON fixtures are now labeled `automated-browser`; the original three cases/header and complete storage/backup files remain byte-identical to Step 2.

## Fresh verification

The [raw output](full-suite.txt) records all 15 commands and their exit codes from one completed `npm run test:all` on the finished release source. The final lines include:

```text
EXIT 0: test:save-apply
CURRENT GraphLab: {"draftSampleRate":96000,"fitSampleRate":96000}
PASS GraphLab preserves and fits at 96000 Hz
EXIT 0: test:lab-sample-rate
ALL LOCAL SUITES PASSED
```

The four PNGs were opened and visually inspected after the run:

| View | 1920px | 390px |
| --- | --- | --- |
| Save dialog | [Desktop](save-preset-dialog-1920.png) | [Phone](save-preset-dialog-390.png) |
| Disabled Apply on static preview | [Desktop](disabled-apply-windows-1920.png) | [Phone](disabled-apply-windows-390.png) |

Evidence is generated locally by `npm run test:all` under ignored `artifacts/step3/`; these selected results are copied into this tracked folder for review in a clone. The live-model suite is separate and was not rerun in this release review.

## Unfinished manual gates

- Historical share capture and browser-history search: not performed. The computer-use runtime stopped because it could not establish Chrome's current URL confidently.
- Physical Windows Apply/listening test: not performed. The actual config was backed up locally and read-only bridge status confirmed its existence; neither the config nor system EQ was changed. The tests in the log use temporary APO configs or intercepted requests and cannot substitute for this manual gate.
- Preview: the user subsequently authorized a branch push so Vercel can build a preview without changing production. The user will supply historical share URLs and manual APO results later. Friend observation uses the preview; merge to main waits for the real Apply result and resolution of unexpected friend-test issues. Step 4 remains held until the friend feedback is back.

See the [full review](../../STEP3_REVIEW.md) for the actual installed path, backup location and readiness result.
