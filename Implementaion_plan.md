# AudioSage UI Fix — Antigravity Implementation Plan

> **Paste this entire document into Antigravity's chat.** It will read the plan and apply every change autonomously using "Code with Agent".

---

## Overview of Issues

| # | Bug | Root Cause | Files Affected |
|---|-----|-----------|----------------|
| 1 | Wide comparison table breaks layout / sidebar disappears | `overflow-x: hidden` on the root `<div>` in `App.tsx` clips the sidebar when a child overflows | `App.tsx`, `MessageBubble.tsx` |
| 2 | Cannot scroll left/right on the table | The message container has `overflow-x: hidden` which prevents horizontal scroll from propagating to the inner table wrapper | `App.tsx`, `MessageBubble.tsx` |
| 3 | Cannot scroll up while AI is streaming | `scrollToBottom()` fires on every `sessions` state change (every streamed chunk), forcibly jumping the viewport to the bottom | `App.tsx` |
| 4 | Sidebar disappears when table is wide | Same as #1 — the root flex container clips when any child exceeds viewport width | `App.tsx` |

---

## Fix 1 — Root Layout Overflow (`App.tsx`)

### Problem
Line 423 in `App.tsx`:
```tsx
<div className="flex h-screen h-screen-mobile bg-audio-base text-audio-text font-sans overflow-x-hidden overflow-y-hidden selection:bg-audio-accent selection:text-black touch-pan-all">
```
`overflow-x-hidden` on the outermost flex container causes two catastrophic side-effects:
- Any child element (the table) that grows wider than the viewport causes the browser to **clip the entire flex row**, making the sidebar vanish.
- It prevents any inner `overflow-x: auto` from working because the parent already hides the overflow.

### Fix
**Remove `overflow-x-hidden` and `overflow-y-hidden` from the root div.** Let the children manage their own overflow independently.

**Find this line (App.tsx ~line 423):**
```tsx
<div className="flex h-screen h-screen-mobile bg-audio-base text-audio-text font-sans overflow-x-hidden overflow-y-hidden selection:bg-audio-accent selection:text-black touch-pan-all">
```

**Replace with:**
```tsx
<div className="flex h-screen h-screen-mobile bg-audio-base text-audio-text font-sans overflow-hidden selection:bg-audio-accent selection:text-black">
```

> `overflow-hidden` (shorthand) sets both axes to hidden **on the root only**, which is fine — it clips the page boundary. The key change is that the sidebar and main column are now independent flex children with their own scroll contexts, so the sidebar will never be pushed off-screen by a child's width.

---

## Fix 2 — Messages Container Overflow (`App.tsx`)

### Problem
Line 486 in `App.tsx`, the messages scroll container:
```tsx
<div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8 ...">
```
`overflow-x-hidden` here means that even though the table wrapper inside has `overflow-x: auto`, the parent has already clipped it — horizontal scroll is impossible.

### Fix
**Change `overflow-x-hidden` to `overflow-x-clip`** (clips visually but does not create a scroll container, so children can still scroll horizontally within themselves).

**Find this block (App.tsx ~line 486):**
```tsx
<div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8 space-y-2 scroll-smooth scroll-touch mobile-scroll-fix bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#101010] to-[#050505]" style={{ WebkitOverflowScrolling: 'touch', overscrollBehaviorY: 'contain' }}>
```

**Replace with:**
```tsx
<div
  className="flex-1 overflow-y-auto overflow-x-clip p-4 md:p-8 space-y-2 scroll-smooth bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#101010] to-[#050505]"
  style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}
>
```

> `overflow-x: clip` is the correct modern value here — it prevents the container from becoming a horizontal scroll container itself (which would fight with `overflow-y: auto`), while still allowing descendant elements to establish their own independent horizontal scroll contexts.

---

## Fix 3 — Streaming Scroll Lock (`App.tsx`)

### Problem
Lines 94–100 in `App.tsx`:
```tsx
const scrollToBottom = () => {
  messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
};

useEffect(() => {
  scrollToBottom();
}, [sessions, currentSessionId, isGenerating]);
```
This fires `scrollToBottom()` on **every single state update** — including every streamed text chunk. So while the AI is typing, the view is constantly snapping back to the bottom, making it impossible to scroll up to re-read earlier content.

### Fix
**Track whether the user has manually scrolled up, and only auto-scroll if they are already near the bottom.**

**Replace the scroll logic section (App.tsx ~lines 94–100) with:**
```tsx
const scrollContainerRef = useRef<HTMLDivElement>(null);
const userScrolledUpRef = useRef(false);

const scrollToBottom = (force = false) => {
  const container = scrollContainerRef.current;
  if (!container) return;
  // Only auto-scroll if user is within 150px of bottom, or if forced (new session)
  const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
  if (force || distanceFromBottom < 150) {
    container.scrollTop = container.scrollHeight;
  }
};

const handleMessagesScroll = () => {
  const container = scrollContainerRef.current;
  if (!container) return;
  const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
  userScrolledUpRef.current = distanceFromBottom > 150;
};

useEffect(() => {
  scrollToBottom();
}, [sessions, currentSessionId]);

// Force scroll to bottom only when a new session is selected
useEffect(() => {
  scrollToBottom(true);
}, [currentSessionId]);
```

**Then add the ref and scroll handler to the messages container div (App.tsx ~line 486):**

Find:
```tsx
<div
  className="flex-1 overflow-y-auto overflow-x-clip p-4 md:p-8 space-y-2 scroll-smooth bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#101010] to-[#050505]"
  style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}
>
```

Replace with:
```tsx
<div
  ref={scrollContainerRef}
  onScroll={handleMessagesScroll}
  className="flex-1 overflow-y-auto overflow-x-clip p-4 md:p-8 space-y-2 scroll-smooth bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#101010] to-[#050505]"
  style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}
>
```

Also **remove the old `messagesEndRef` div** at the bottom of the messages list:
```tsx
<div ref={messagesEndRef} />   // DELETE THIS LINE
```

And remove `messagesEndRef` from the top of the component:
```tsx
const messagesEndRef = useRef<HTMLDivElement>(null);  // DELETE THIS LINE
```

> Now the view only snaps to the bottom when you're already near the bottom. If you scroll up to re-read, streaming continues without pulling you back down.

---

## Fix 4 — MessageBubble Containment (`MessageBubble.tsx`)

### Problem
The AI message bubble wrapper has `overflow-hidden` which clips the table's horizontal scroll container before it gets a chance to scroll:
```tsx
// MessageBubble.tsx ~line 155
className={`... overflow-hidden ...`}
```

And the inner content wrapper also has `overflow-hidden`:
```tsx
// MessageBubble.tsx ~line 167
<div className="leading-relaxed text-[15px] font-light tracking-wide break-words overflow-hidden w-full min-w-0">
```

### Fix

**In MessageBubble.tsx, find the outer bubble div (~line 155):**
```tsx
className={`w-full max-w-7xl rounded-2xl px-4 py-4 md:px-6 md:py-5 shadow-lg backdrop-blur-sm flex flex-col min-w-0 overflow-hidden ${isUser
```

**Replace `overflow-hidden` with `overflow-visible` for AI messages only:**
```tsx
className={`w-full max-w-7xl rounded-2xl px-4 py-4 md:px-6 md:py-5 shadow-lg backdrop-blur-sm flex flex-col min-w-0 ${isUser
  ? 'bg-audio-highlight border border-audio-border text-white rounded-br-sm ml-auto max-w-[90%] sm:max-w-[80%] overflow-hidden'
  : 'bg-[#101010] border border-audio-border/50 text-audio-text rounded-bl-sm max-w-full overflow-visible'
}`}
```

**Then find the inner content div (~line 167):**
```tsx
<div className="leading-relaxed text-[15px] font-light tracking-wide break-words overflow-hidden w-full min-w-0">
```

**Replace with:**
```tsx
<div className="leading-relaxed text-[15px] font-light tracking-wide break-words w-full min-w-0">
```

> Removing `overflow-hidden` here lets the table's own scroll container work correctly. The table wrapper in `renderTable()` already has `overflow-x-auto` with a border and rounded corners — that is sufficient containment.

---

## Fix 5 — Table Wrapper (`MessageBubble.tsx`)

The table wrapper in `renderTable()` is already mostly correct. Make two small improvements:

**Find the table scroll div inside `renderTable` (~line 112):**
```tsx
<div
  className="w-full overflow-x-auto overscroll-x-contain rounded-lg border border-audio-border shadow-md bg-[#080808] scrollbar-thin"
  style={{
    WebkitOverflowScrolling: 'touch',
    touchAction: 'pan-x',
    scrollbarWidth: 'thin'
  }}
>
```

**Replace with:**
```tsx
<div
  className="w-full overflow-x-auto rounded-lg border border-audio-border shadow-md bg-[#080808] scrollbar-thin"
  style={{
    WebkitOverflowScrolling: 'touch',
    overscrollBehavior: 'contain auto',
    scrollbarWidth: 'thin',
    maxWidth: '100%'
  }}
>
```

> Removing `touchAction: 'pan-x'` allows vertical scrolling of the page while also allowing horizontal table scrolling — they no longer conflict.

---

## Fix 6 — `index.css` Global Overflow

### Problem
```css
html, body {
  max-width: 100vw;
  overflow-x: hidden;
}
```
`overflow-x: hidden` on `body` is a classic culprit — it creates a new stacking context and breaks `position: sticky` in children (including the sticky first column of the table). It also contributes to the layout-break symptoms.

### Fix
**In `index.css`, find:**
```css
html,
body {
  max-width: 100vw;
  overflow-x: hidden;
}
```

**Replace with:**
```css
html,
body {
  max-width: 100vw;
  overflow-x: clip;
}
```

> `overflow-x: clip` prevents horizontal scrollbars on the document level without creating a new block formatting context, preserving `position: sticky` behavior in child elements.

---

## Summary of All Changes

| File | Location | Change |
|------|----------|--------|
| `App.tsx` | Root div (line ~423) | `overflow-x-hidden overflow-y-hidden` → `overflow-hidden` |
| `App.tsx` | Messages container (line ~486) | `overflow-x-hidden` → `overflow-x-clip`; remove `mobile-scroll-fix scroll-touch` classes |
| `App.tsx` | Messages container (line ~486) | Add `ref={scrollContainerRef}` and `onScroll={handleMessagesScroll}` |
| `App.tsx` | Scroll logic (lines ~94–100) | Replace `scrollToBottom` + `useEffect` with smart proximity-based scroll |
| `App.tsx` | Remove `messagesEndRef` | Delete `useRef` declaration and `<div ref={messagesEndRef} />` |
| `MessageBubble.tsx` | Outer bubble div (~line 155) | Remove `overflow-hidden` from AI message bubble; keep it for user bubbles |
| `MessageBubble.tsx` | Inner content div (~line 167) | Remove `overflow-hidden` |
| `MessageBubble.tsx` | Table scroll div in `renderTable` | Remove `touchAction: 'pan-x'`; add `overscrollBehavior: 'contain auto'` |
| `index.css` | `html, body` block | `overflow-x: hidden` → `overflow-x: clip` |

---

## What NOT to Change

- `TableModal.tsx` — the modal is fine; it already has `overflow: auto` correctly.
- `Sidebar.tsx` — sidebar is fine; it has `flex-shrink-0` which is correct.
- `prose-table` CSS in `index.css` — table styles are correct.
- All Tailwind config / `tailwind.config.js` — no changes needed.

---

## Expected Result After Fixes

- ✅ Sidebar stays visible regardless of how wide the comparison table is
- ✅ Comparison tables scroll horizontally within their own container
- ✅ You can scroll up freely while the AI is still generating a response
- ✅ Auto-scroll resumes when you're already near the bottom (normal chat flow)
- ✅ Sticky first column in tables continues to work correctly
- ✅ No zoom-in/zoom-out workaround needed