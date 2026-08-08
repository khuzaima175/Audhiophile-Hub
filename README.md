<div align="center">

# 🎛️ AudioSage: Audiophile Research Assistant & Acoustic Suite

**An elite AI-driven companion, acoustic knowledge engine, and real-time DSP tuning workbench tailored specifically for audiophiles, IEM enthusiasts, and headphone hobbyists.**

[![React Version](https://img.shields.io/badge/React-19.2-61DAFB.svg?style=flat-square&logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.2-646CFF.svg?style=flat-square&logo=vite)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6.svg?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC.svg?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)
[![Gemini 3.6 Flash](https://img.shields.io/badge/Gemini_3.6_Flash-Google_AI-FFA116.svg?style=flat-square&logo=google)](https://ai.google.dev/)
[![Theme](https://img.shields.io/badge/Theme-Warm_Hi--Fi_Chassis-C6934F.svg?style=flat-square)](#-design-system-warm-hi-fi-chassis)
[![License](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](LICENSE)

</div>

---

## 📑 Table of Contents

- [✨ Executive Summary](#-executive-summary)
- [🚀 Comprehensive Feature Catalog](#-comprehensive-feature-catalog)
  - [1. 🎛️ EQ Workbench & Live Web Audio DSP Audition Engine](#1-️-eq-workbench--live-web-audio-dsp-audition-engine)
  - [2. 📈 CrinGraph Acoustic Frequency Response Suite](#2--cringraph-acoustic-frequency-response-suite)
  - [3. ⚔️ Battle Mode Product Shootouts & Google Grounding](#3-️-battle-mode-product-shootouts--google-grounding)
  - [4. 🧠 Persistent Acoustic RAG, Memory Lane & Knowledge Base](#4--persistent-acoustic-rag-memory-lane--knowledge-base)
  - [5. ⚡ Gemini 3.6 Flash Multi-Model AI Engine & Streaming Pipeline](#5--gemini-36-flash-multi-model-ai-engine--streaming-pipeline)
  - [6. 🎚️ Home Console Hardware Bay & Harmonic Oscilloscope](#6-️-home-console-hardware-bay--harmonic-oscilloscope)
  - [7. 📚 Interactive Audiophile Glossary with Hover Cards](#7--interactive-audiophile-glossary-with-hover-cards)
  - [8. ⌨️ Global Command Palette (⌘K) & Navigation Power Layer](#8-️-global-command-palette-k--navigation-power-layer)
  - [9. 💾 Digital Headroom Safety, Universal Importer & Portability](#9--digital-headroom-safety-universal-importer--portability)
- [📐 Mathematical Foundations & DSP Transfer Functions](#-mathematical-foundations--dsp-transfer-functions)
- [🎯 Reference Target Curve Datasets](#-reference-target-curve-datasets)
- [🎨 Design System: Warm Hi-Fi Chassis](#-design-system-warm-hi-fi-chassis)
- [🛠️ Tech Stack & Architecture](#️-tech-stack--architecture)
- [📂 Project Structure](#-project-structure)
- [📦 Getting Started & Installation](#-getting-started--installation)
- [⌨️ Keyboard Shortcuts Cheatsheet](#️-keyboard-shortcuts-cheatsheet)
- [📜 Complete Evolution & Version Changelog](#-complete-evolution--version-changelog)

---

## ✨ Executive Summary

**AudioSage** bridges rigorous acoustic science with personal listening preferences. Built around a tactile **Warm Hi-Fi Chassis** aesthetic inspired by vintage analog amplifiers, McIntosh instrumentation, brushed brass faceplates, and analog VU meters, AudioSage provides deep technical gear analysis, auto-EQ targeting, multi-gear shootout comparisons, in-browser audio synthesis, and long-term acoustic memory.

Whether you're deciding between planar magnetic IEMs, fine-tuning your daily driver against the **Crinacle IEF Preference 2025 (B&K 5128)** or **Harman In-Ear 2019** targets, or generating verified **Equalizer APO** and **Wavelet** presets with automatic digital headroom clipping safety, AudioSage provides instant, verified, and personalized audio intelligence.

---

## 🚀 Comprehensive Feature Catalog

### 1. 🎛️ EQ Workbench & Live Web Audio DSP Audition Engine

The built-in Acoustic EQ Workbench is a studio-grade DSP synthesizer and real-time audio playback lab running directly in the browser via Web Audio API:

* **Interactive Transfer Function**: Real-time 60 FPS SVG curve synthesis calculated dynamically over a continuous 180-point logarithmic frequency continuum ($20\text{ Hz} \to 20\text{ kHz}$).
* **Multi-Band ISO Graphic Modes**:
  * **10-Band (Octave)**: Standard octave studio faders ($31.25\text{ Hz} \to 16\text{ kHz}$, $Q=1.41$).
  * **15-Band ($2/3$-Octave)**: Intermediate precision graphic mode ($25\text{ Hz} \to 16\text{ kHz}$, $Q=2.0$).
  * **31-Band ($1/3$-Octave)**: Full mastering-grade 31-band ISO fader rack ($20\text{ Hz} \to 20\text{ kHz}$, $Q=4.3$).
  * *Tactile controls*: Vertical slider tracks with knurled brass thumbs, center zero detent lines, and double-click to zero-reset individual bands.
* **Parametric PEQ Filter Builder**: Surgical cascade editor supporting all major filter topologies:
  * **Peak / Bell (PK)** with adjustable Center Frequency ($F_c$), Gain ($\pm 18\text{ dB}$), and Quality Factor ($Q = 0.1 \to 10$).
  * **Low Shelf (LS / LSC)** and **High Shelf (HS / HSC)** 2nd-order shelving filters.
  * **12dB/octave Butterworth High Pass (HP)** and **Low Pass (LP)** filters.
  * **Band Stop / Notch (NOTCH / NO)** for surgical sibilance attenuation.
* **Tier-2 Live Web Audio Audition Engine**:
  * **Voss-McCartney $1/f$ Pink Noise Generator**: Seamless 5-second buffer looping with authentic natural spectral density.
  * **$20\text{ Hz} \to 20\text{ kHz}$ Logarithmic Sine Sweep**: 6-second exponential frequency sweep across the human audible range to audit acoustic dips and peaks.
  * **Local Audio Audition Track**: Upload your own `.mp3`, `.wav`, `.flac`, `.aac`, or `.ogg` tracks to hear your active EQ curves applied live in real-time.
  * **Zero-Pop Latching A/B Bypass Switch**: Features a 30ms linear crossfade gain transition between wet (filtered) and dry (unprocessed) channels with amber/green LED indicators.
* **Preamp Clipping Safety Guard**: Calculates the maximum positive boost and automatically derives negative digital headroom ($\text{Preamp} = \min(0, -\max(\text{Gain}) - 0.2\text{ dB})$) to eliminate digital inter-sample clipping in export files.
* **Universal Import & Export**: One-click bidirectional parser and text generator for:
  * **Equalizer APO / Peace GUI (Windows)**
  * **Wavelet GraphicEQ (Android)**
  * **Parametric EQ Configs / AutoEQ (`.txt`)**

---

### 2. 📈 CrinGraph Acoustic Frequency Response Suite

A signature visualization component (`FRGraph.tsx`) engineered specifically for audiophile frequency response curve inspection:

* **High-Density Reference Target Overlays**:
  * **Crinacle IEF Preference 2025 (B&K 5128)**: 35 calibrated reference points with linear sub-bass extension, a clean 200 Hz mid-bass tuck, and smooth 8 kHz ear canal resonance pinna notch.
  * **Harman In-Ear 2019 Target (Verbatim 301-Point Dataset)**: Full verbatim Olive-Welti curve featuring +8.1 dB sub-bass shelf, -1.24 dB acoustic dip at 300 Hz, +9.89 dB pinna ear-gain peak at 3.2 kHz, and -20.1 dB high treble cliff.
  * **Sennheiser HD600 Acoustic Benchmark**: 17 reference points normalized at 1 kHz for organic vocal timbre and natural transient decay.
  * **Flat Studio Reference (0.0 dB)**: Completely unweighted baseline across the entire 20 Hz to 20 kHz continuum.
* **CrinGraph 1–1.5–2–3–4–6–8 Decade Ticks**: Standardized acoustic decade ticks (20, 30, 40, 60, 80, 100, 150, 200, 300, 400, 600, 800, 1k, 1.5k, 2k, 3k, 4k, 6k, 8k, 10k, 15k, 20k).
* **Dynamic Auto-Ranging Y-Axis**: Dynamically recalculates min/max Y bounds with $\pm 2.0\text{ dB}$ headroom padding snapped to 6 dB grid intervals, preventing clipping on the Harman 20 kHz treble cliff or deep PEQ boosts.
* **Magnetic Dual-Curve Crosshair**: Interactive cursor tracking that displays simultaneous live readouts: `Frequency • Measured dB vs. Target dB (Delta dB)`.
* **Personal Sibilance Risk Zone (6 kHz – 9 kHz)**: Highlighted amber acoustic corridor alerting users to treble peaks prone to fatigue or sibilance.
* **Dev-Time Anchor Assertion System**: Built-in verification assertions (`assertTargetCurveAnchors()`) that loudly validate mathematical anchors upon module startup.

---

### 3. ⚔️ Battle Mode Product Shootouts & Google Grounding

* **Multi-Gear Shootout Engine**: Compare up to 3 IEMs, headphones, or DACs side-by-side with real-time **Google Search Grounding**.
* **Comprehensive Parameter Analysis**:
  * **Driver Technology**: Single Dynamic Driver (1DD), Multi-BA, Planar Magnetic, Tribrid (DD+BA+EST), Electrostatic (EST), and solid-state xMEMS.
  * **Timbre & Decay**: Musical/wet analog decay vs. ultra-fast/dry analytical response.
  * **Soundstage & 3D Holographic Imaging**: Stereo width, depth layering, and pinpoint localization.
  * **Acoustic Quirks & Sensitivities**: 200 Hz mid-bass warmth vs. clean tuck, 4 kHz pinna shout, and 8 kHz sibilance peaks.
  * **Driveability**: Electrical Impedance ($\Omega$) and Sensitivity ($\text{dB/mW}$ or $\text{dB/Vrms}$).
  * **Price & Value Tiering**: Real-time MSRP verification via live web search.
* **Battle Mode Selector**: Select contenders directly from your registered Gear Rack and launch automated shootout matrices.

---

### 4. 🧠 Persistent Acoustic RAG, Memory Lane & Knowledge Base

* **Personalized Listener Profile**: Captures your sound signature preferences, active gear inventory, and acoustic quirks.
* **Live Tuning Faders**:
  * **Sub-Bass Shelf (100 Hz)**: Adjust sub-bass punch ($\pm 6\text{ dB}$).
  * **8 kHz Sibilance Notch**: Surgical reduction for treble sensitivity ($-6\text{ dB} \to +3\text{ dB}$).
  * **10 kHz+ Treble Air**: Ultra-high frequency sparkle and micro-detail ($\pm 6\text{ dB}$).
  * *Instant Compilation*: Automatically synthesizes fader positions into persistent neural system prompt instructions.
* **Automated Session Summarizer (`generateSessionSummary`)**: Analyzes past research transcripts and extracts structured topics, conclusions, and key technical facts into permanent storage.
* **Persistent RAG Retrieval Engine**: Evaluates user prompts against historical conversation logs and consolidated knowledge base entries, dynamically injecting matching acoustic context.
* **Full Data Portability**: 1-click JSON backup export and import for all chat sessions, listener profiles, gear libraries, and custom EQ presets.

---

### 5. ⚡ Gemini 3.6 Flash Multi-Model AI Engine & Streaming Pipeline

* **Multi-Tier Fallback Architecture**: Primary reasoning runs on `gemini-3.6-flash`, backed by seamless automatic fallback chains to `gemini-2.5-flash` and `gemini-2.0-flash` for high reliability.
* **Senior Audio Research Engineer Mode**: Toggleable advanced protocol that activates in-depth technical analysis for:
  * **Group Delay & Minimum Phase Response**
  * **Impulse Response & Transient Snappiness**
  * **THD (Total Harmonic Distortion) & SINAD**
  * **Output Impedance & Damping Factor**
  * **Nyquist Limits & Anti-Aliasing Filters**
* **Multimodal Query Capabilities**:
  * Text-based natural language inquiries.
  * **Frequency Graph Image Upload**: Upload any measured FR graph to automatically calculate transfer function gain offsets against Crinacle IEF 2025.
  * **In-Browser Voice Query**: Seamless audio recording with browser-optimized Opus, WebM, and AAC encoding.
* **Streaming Signal-Chain Timeline**: Visual state chips tracking AI execution phases: `[SEARCH ✓] [RAG …] [VERIFY]`.
* **Telemetry & Error Recovery**:
  * Real-time TTFT (Time-To-First-Token) latency monitor.
  * Intelligent error handler (`ErrorCard.tsx`) with quota/key detection, retry action, and raw error telemetry inspection drawer.
  * In-modal Gemini API Key live connection tester.

---

### 6. 🎚️ Home Console Hardware Bay & Harmonic Oscilloscope

* **Analog Telemetry Bays**: Dual hardware VU-meters with animated needle idle-sway and startup boot sweep.
* **Harmonic FFT Waveform Oscilloscope (`CompositeSineCanvas.tsx`)**: Real-time canvas visualizer rendering fundamental (1 kHz) and harmonic (3 kHz, 5 kHz) composite sine waves that animate dynamically during active streaming.
* **Hardware StatDials**: Four rotary numerical dials tracking permanent memories, gear rack count, EQ library presets, and shootout sessions.
* **First-Run System Setup Checklist**: Guided 3-step verification card for Gemini API Key configuration, gear registration, and target curve creation.
* **Active Gear Rack Rail**: Quick-access carousel displaying daily driver status with color-coded hardware LEDs.

---

### 7. 📚 Interactive Audiophile Glossary with Hover Cards

* **20+ Curated Audiophile Terms**: Instant inline hover cards over technical acoustic concepts:
  * *Soundstage, Imaging, Separation, Sibilance, Timbre, Decay, Transient, Roll-off, Sub-bass, Mid-bass, Bloat, Treble, Mids, THD, Impedance, Sensitivity, DAC, AMP, IEM, Harman Target, Diffuse Field, Dynamic Driver, Balanced Armature, Planar Magnetic, Tribrid, EST*.
* **Smart Auto-Positioning**: Cards calculate viewport bounds to prevent edge clipping, featuring definitions, examples, and icon badges.

---

### 8. ⌨️ Global Command Palette (⌘K) & Navigation Power Layer

* **Global Shortcut Access**: Press `⌘K` (Mac) or `Ctrl+K` (Windows/Linux) from any screen to open the command palette.
* **Universal Search**: Instant fuzzy filtering across:
  * **Quick Actions**: New Research, EQ Targeter, Auto-EQ from Graph, Gear Rack, Senior Tech Mode.
  * **Chat Sessions**: Jump directly into any historical shootout or analysis.
  * **Gear Collection**: Search your owned, wishlist, and tested gear.
  * **Permanent Memories**: Search acoustic sensitivity rules.
* **Keyboard Navigation**: Full `ArrowUp`, `ArrowDown`, `Enter`, and `Escape` support.

---

### 9. 💾 Digital Headroom Safety, Universal Importer & Portability

* **Digital Safety Headroom**: Automatic negative preamp calculation prevents digital clipping when exporting high-boost EQ profiles:
  $$\text{Preamp} = \min(0, -\max(\text{Gains}) - 0.2\text{ dB})$$
* **Bidirectional Parser**: Paste raw text from AutoEQ, Equalizer APO config lines, or Wavelet `GraphicEQ:` strings to automatically parse frequencies and populate sliders/PEQ filters.
* **Export Formats**:
  * Equalizer APO / Peace format (`Filter X: ON PK Fc ... Gain ... Q ...`)
  * Wavelet Android format (`GraphicEQ: 20 0.0; ... Preamp: -X.X dB`)
  * Generic Parametric PEQ text file (`.txt` download)

---

## 📐 Mathematical Foundations & DSP Transfer Functions

AudioSage implements standard digital biquad filter transfer functions in the frequency domain for interactive curve synthesis and audio graph rendering:

### 1. Peaking Bell Filter (PK)
$$H_{\text{PK}}(f) = \frac{\text{Gain}}{1 + \left(\left|\frac{f}{F_c} - \frac{F_c}{f}\right| \cdot Q\right)^2}$$

### 2. Low-Shelf Filter (LS)
$$H_{\text{LS}}(f) = \frac{\text{Gain}}{1 + \left(\frac{f}{F_c}\right)^2}$$

### 3. High-Shelf Filter (HS)
$$H_{\text{HS}}(f) = \frac{\text{Gain}}{1 + \left(\frac{F_c}{f}\right)^2}$$

### 4. 2nd-Order Butterworth High Pass / Low Pass
$$H_{\text{HP}}(f) = -10 \cdot \log_{10}\left(1 + \left(\frac{F_c}{f}\right)^4\right) \quad (\text{clamped at } -36\text{ dB})$$
$$H_{\text{LP}}(f) = -10 \cdot \log_{10}\left(1 + \left(\frac{f}{F_c}\right)^4\right) \quad (\text{clamped at } -36\text{ dB})$$

### 5. Composite Transfer Function
The composite curve at any frequency $f \in [20\text{ Hz}, 20\text{ kHz}]$ is the linear superposition of all active graphic and parametric filters:
$$H_{\text{total}}(f) = \sum_{i=1}^{N_{\text{ISO}}} H_{\text{PK}}(f, F_i, G_i, Q_{\text{ISO}}) + \sum_{k=1}^{M_{\text{PEQ}}} H_k(f, F_k, G_k, Q_k)$$

---

## 🎯 Reference Target Curve Datasets

| Target Reference | Origin & Standard | Anchor Values / Characteristics | Primary Application |
| :--- | :--- | :--- | :--- |
| **Crinacle IEF Preference 2025** | B&K 5128 (Normalized 1 kHz) | 20 Hz: +6.5 dB • 200 Hz: +0.2 dB • 3 kHz: +9.8 dB • 8 kHz: +3.6 dB | Modern diffuse-field tilt with natural vocal intimacy |
| **Harman In-Ear 2019** | Harman Research / Olive-Welti (301 pts) | 20 Hz: +8.1 dB • 300 Hz: -1.24 dB • 3.2 kHz: +9.89 dB • 20 kHz: -20.1 dB | Energetic sub-bass shelf with forward upper midrange |
| **Sennheiser HD600 Benchmark** | IEC 711 Reference Target | 20 Hz: -3.5 dB • 1 kHz: +1.0 dB • 3 kHz: +6.8 dB • 8 kHz: +2.2 dB | Organic instrumental timbre & realistic vocal decay |
| **Flat Studio Reference** | Unweighted 0.0 dB Baseline | 20 Hz: 0.0 dB • 1 kHz: 0.0 dB • 20 kHz: 0.0 dB | Pure mathematical uncolored studio baseline |

---

## 🎨 Design System: Warm Hi-Fi Chassis

AudioSage features a custom dark-mode aesthetic inspired by tactile high-end audio engineering gear:

```
Chassis Palette Tokens:
├── #0F0C0A  (audio-base)          ── Matte Chassis Black
├── #1A1512  (audio-surface)       ── Brushed Faceplate Panel
├── #231D18  (audio-highlight)     ── Active/Hover Panel Surface
├── #332B23  (audio-border)        ── Hairline Chassis Border
├── #C6934F  (audio-accent)        ── Brushed Brass Accent
├── #E7B87A  (audio-accent-bright) ── Glowing Brass Filament
├── #EDE6DA  (audio-text)          ── VU-Meter Cream (Primary Typography)
├── #9C8F7D  (audio-muted)         ── Muted Gray-Brown (Labels & Units)
├── #6FC9A6  (audio-signal)        ── Phosphor Teal (Verified Signal)
├── #7FD8B4  (audio-led)           ── Healthy Channel LED
├── #D97748  (audio-warn)          ── Analog Needle Orange-Red
└── #E06A3F  (audio-led-red)       ── Fault / Sibilance Alert LED
```

### Typography Matrix
* **Display / Brand**: `Space Grotesk` (Headers, branding, model switchers)
* **Prose & Body**: `Inter` (Nuanced explanations, analysis, glossary copy)
* **Data & Telemetry**: `JetBrains Mono` (Specs, frequency scales, PEQ values, timestamps)

---

## 🛠️ Tech Stack & Architecture

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **UI Framework** | [React 19.2](https://react.dev/) | High-performance reactive state management |
| **Build System** | [Vite 6.2](https://vitejs.dev/) | Instant HMR and optimized production bundle |
| **Language** | [TypeScript 5.8](https://www.typescriptlang.org/) | Strict type-safety across audio schemas & DSP filters |
| **Styling** | [Tailwind CSS 3.4](https://tailwindcss.com/) + Vanilla CSS | Design tokens, containment layouts & hardware textures |
| **AI SDK** | [@google/genai 1.37](https://ai.google.dev/) | Gemini 3.6 Flash multimodal streaming & tool calls |
| **Search Grounding** | Google Search Tool | Real-time specification, pricing, and driver verification |
| **Audio Engine** | Web Audio API (`AudioContext`, `BiquadFilterNode`) | Real-time filter cascade, noise generation & A/B bypass |
| **Vector / Storage** | LocalStorage + JSON Export | Persistent offline-ready memory & listener profile |

---

## 📂 Project Structure

```
Audhiophile-Hub/
├── components/
│   ├── ui/
│   │   ├── Engraved.tsx         # Tactile chassis engraved text badge
│   │   ├── Fader.tsx            # Analog rotary / vertical tuning fader
│   │   ├── Led.tsx              # Hardware status indicator LED with pulse
│   │   ├── Panel.tsx            # Chassis panel container with brushed texture
│   │   ├── StatDial.tsx         # Hardware gauge dial with count-up animations
│   │   ├── Toast.tsx            # Floating feedback alert pill
│   │   └── VUMeter.tsx          # Dual analog needle VU meter with boot sweep
│   ├── CommandPalette.tsx       # Global ⌘K quick-action power layer
│   ├── CompositeSineCanvas.tsx  # Harmonic FFT oscilloscope visualizer
│   ├── EQWorkbench.tsx          # Full DSP tuning workbench & Web Audio engine
│   ├── ErrorCard.tsx            # Connection fault handler with raw error drawer
│   ├── FRGraph.tsx              # CrinGraph 20Hz-20kHz curve visualizer
│   ├── GlossaryTooltip.tsx      # Audiophile dictionary with hover cards
│   ├── Header.tsx               # Rotary engine selector & TTFT latency strip
│   ├── HomeConsole.tsx          # Main hardware console & system setup checklist
│   ├── Icon.tsx                 # Curated Hi-Fi vector SVG icon library
│   ├── InputConsole.tsx         # Segmented query inputs, mic recorder & graph upload
│   ├── MessageBubble.tsx        # Assistant panels, signal chips & spec tables
│   ├── SettingsModal.tsx        # 5-tab modal: Profile, EQ, Gear Rack, Facts, RAG
│   └── Sidebar.tsx              # Session history, pin actions & model telemetry
├── constants/
│   └── targetCurves.ts          # Harman 2019 (301pts), IEF 2025, HD600 & ISO bands
├── hooks/
│   └── useAudioEngine.ts        # Web Audio API lifecycle, filter cascade & A/B bypass
├── services/
│   └── geminiService.ts         # Gemini 3.6 Flash SDK client, RAG & Battle Analyst
├── utils/
│   ├── curveSynthesizer.ts      # Biquad filter formulas & dynamic Y auto-ranging
│   └── importExportParser.ts    # Equalizer APO, Wavelet & AutoEQ bidirectional parser
├── types.ts                     # TypeScript schemas (AudioProfile, EQPreset, GearItem)
├── index.css                    # Hardware design tokens, chassis grain & table layouts
├── tailwind.config.js           # Warm Hi-Fi chassis palette & keyframe animations
├── index.html                   # HTML entrypoint & typography font imports
├── App.tsx                      # Root application container & multimodal controller
├── vite.config.ts               # Vite bundler configuration
└── package.json                 # Project dependencies and npm scripts
```

---

## 📦 Getting Started & Installation

### Prerequisites

* [Node.js](https://nodejs.org/) (version 18.0 or higher recommended)
* [npm](https://www.npmjs.com/) or [pnpm](https://pnpm.io/)
* A free [Gemini API Key](https://aistudio.google.com/app/apikey) from Google AI Studio

### Installation Steps

1. **Clone the repository:**
   ```bash
   git clone https://github.com/khuzaima175/Audhiophile-Hub.git
   cd Audhiophile-Hub
   ```

2. **Install project dependencies:**
   ```bash
   npm install
   ```

3. **Configure your Environment:**
   Create a `.env.local` file in the project root:
   ```env
   VITE_GEMINI_API_KEY=your_gemini_api_key_here
   ```
   *(Note: You can also enter and test your API Key directly inside the app's Settings Modal without restarting).*

4. **Start the local development server:**
   ```bash
   npm run dev
   ```
   Navigate to [http://localhost:3000](http://localhost:3000) or the port displayed in your terminal.

5. **Build for production:**
   ```bash
   npm run build
   ```

---

## ⌨️ Keyboard Shortcuts Cheatsheet

| Shortcut | Context | Action |
| :--- | :--- | :--- |
| `⌘K` or `Ctrl+K` | Global | Open / close the Command Palette |
| `Enter` | Input Console | Transmit query to Gemini AI |
| `Shift + Enter` | Input Console | Insert a newline in the input field |
| `Escape` | Modals / Palette | Dismiss active modal or palette window |
| `ArrowDown` / `ArrowUp` | Command Palette | Navigate through search results |
| `Double-Click` | EQ Sliders | Zero-out the selected graphic frequency band ($0.0\text{ dB}$) |

---

## 📜 Complete Evolution & Version Changelog

* ✅ **Stage 0: Design System Foundation**: Implemented design tokens (`audio-accent-bright`, `audio-led`, `audio-led-red`, `audio-signal`), brushed metallic textures, film grain overlay, and UI primitives (`Panel`, `Led`, `Engraved`, `VUMeter`, `StatDial`, `Fader`, `Toast`).
* ✅ **Stage 1: Hardware Chassis Shell**: Built 288px responsive sidebar, interactive User Profile card with live memory/gear counters, nav-rail deep links, cassette-tape empty states, online status LED, and header rotary model selector.
* ✅ **Stage 2: Home Console Bay**: Implemented Home Console rack system with StatDials, dual VU meters with startup sweep, composite harmonic oscilloscope canvas, 3-step System Setup checklist, and gear rack rail.
* ✅ **Stage 3: Chat Experience Overhaul**: Added tape-label user cards, assistant hardware panels with 2px brass rail, live streaming signal-chain timeline chips (`[SEARCH ✓] [RAG …] [VERIFY]`), and error handling cards fixing raw literal `\n` escaping with retry and API test actions.
* ✅ **Stage 4: Acoustic Knowledge Base**: Built 5-tab segmented settings modal with live acoustic tuning faders (`Fader.tsx`), 10/15/31-band EQ synthesizer, gear rack shootout selector, manual facts backup manager, and automated RAG summarizer.
* ✅ **Stage 5: CrinGraph FR Visualization**: Signature data-viz suite (`FRGraph.tsx`) with $20\text{ Hz} \to 20\text{ kHz}$ logarithmic decade ticks, dashed phosphor Crinacle IEF 2025 target overlay, magnetic hover crosshair, shaded 6–9 kHz sibilance risk corridor, and 1-click Wavelet export.
* ✅ **Stage 6: Motion & Feedback Layer**: Fluid `.stagger` animations, needle idle-sway, count-up numeric dials, and tactile modal transitions.
* ✅ **Stage 7: Power Navigation Layer**: Global ⌘K / Ctrl+K Command Palette, full keyboard navigation, and runtime Google AI Studio connection test suite.
* ✅ **Stage 8: Mobile & Accessibility Hardening**: Comprehensive touch optimization ($\ge 44\text{px}$ targets), ARIA compliance, `prefers-reduced-motion` compliance, and verified zero-error production build.

---

<div align="center">

**Built with passion for the global audiophile and IEM community. Happy listening! 🎧**

</div>
