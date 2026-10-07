# Implementation evidence

Starting revision: bc96299a4e51b889cbbfda55f991dc187bcecef9. Working tree clean at start. User plan preserved in IMPLEMENTATION_PLAN.md. Deployment is separate.

## Milestone 0

Passed baseline: TypeScript, production build, core tests, APO fixtures. Browser audit uses installed Chromium; Edge is unavailable on this host.

Confirmed by code: Options menu clipped inside scrolling graph rows; independent Escape handlers; inconsistent key resolution; build-time shared-key injection; dropdown default differs from graph default; display transforms used as fitting inputs; saved measurements/preamp not restored; stale fit plotted after editing.

Needs verification: exact reported toast overlaps, live model availability/account permissions, deployed public assets, physical listening, Edge/WebKit, Windows APO integration.

Implemented portal Options with scroll/resize placement, touch pointer dismissal, keyboard focus navigation/restoration. Registered surfaces dismiss one at a time. Passive notifications use a pointer-transparent accessible area. Key resolution is shared; capability test makes a streaming request with grounding. Model catalog is centralized; research only falls back for unavailable models. Production environment injection is removed (both GEMINI and VITE_GEMINI sources remain development-only). Personal browser keys are used for hosted mode. No deployed URL or affected credential is available; deployed exposure/rotation cannot be verified here.
