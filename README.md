<div align="center">

# 🎧 AudioSage: Audiophile Research Assistant

**The ultimate AI companion for audiophiles and IEM enthusiasts.**

[![React Version](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)
[![Build Status](https://img.shields.io/badge/Build-Passing-green.svg)](#)
[![Theme](https://img.shields.io/badge/Theme-Dark--Gold-goldenrod.svg)](#)

</div>

---

## ✨ Overview

AudioSage is a high-performance, AI-driven research assistant designed to help audiophiles make better gear decisions. Leveraging the power of Google's **Gemini 3 Flash**, it provides deep technical analysis, personalized parametric EQ profiles, and responsive product comparisons.

Whether you're looking for your next pair of IEMs or trying to tune your current setup to the **Crinacle IEF Preference 2025** target, AudioSage has you covered.

---

## 🚀 Key Features

* **⚔️ Battle Mode Comparison Tables**: Multi-column technical specifications compared side-by-side. Featuring a **sticky headers & features column** for fluid scrolling and a **mobile-optimized responsive layout**.
* **📈 Visual EQ Analysis**: Upload frequency response graphs, and AudioSage will calculate precise gain offsets to match your target.
* **📱 Wavelet & Parametric EQ Integration**: Automatically generates 9-band fixed EQ presets (GraphicEQ) and full Parametric EQ configuration strings (including pre-amp and filter Q) for easy export.
* **🧠 Personalized RAG Knowledge Base**: Remembers your sound preferences, technical preferences, sensitive frequencies (e.g., 8kHz sibilance), and gear history to provide increasingly tailored advice.
* **🎙️ Voice & Image Support**: Interact via voice commands or upload measurements directly for immediate visual parsing.
* **🔬 Advanced Engineering Mode**: Toggle technical depth for detailed discussions on Group Delay, Impulse Response, and driver technology.
* **📜 Smart Proximity Streaming Scroll**: Intelligently tracks user scroll position. If you scroll up to read earlier responses, auto-scrolling suspends. If you are near the bottom of the chat, auto-scroll gracefully handles incoming streamed text chunks.
* **✨ Premium Dark-Gold Styling**: Styled with curated HSL color palettes and a customized scrollbar theme (`#D4AF37`) matching the dark luxury aesthetic.

---

## 🛠️ Tech Stack

* **Frontend**: [React 19](https://react.dev/), [Vite](https://vitejs.dev/), [TypeScript](https://www.typescriptlang.org/)
* **Styling**: [Tailwind CSS](https://tailwindcss.com/), Custom Vanilla CSS Containment Layouts
* **AI Engine**: [Google Gemini SDK](https://ai.google.dev/) (Gemini 3 Flash / 2.5 Flash Fallback)
* **Search**: Integrated Google Search Grounding for real-time spec verification and source listing.

---

## 📦 Getting Started

### Prerequisites

* [Node.js](https://nodejs.org/) (Latest LTS recommended)
* A [Gemini API Key](https://ai.google.dev/) (Get it from Google AI Studio)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/khuzaima175/Audhiophile-Hub.git
   cd Audhiophile-Hub
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment:**
   Create a `.env.local` file in the root directory and add your API key:
   ```env
   VITE_GEMINI_API_KEY=your_actual_api_key_here
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```

5. **Build for Production:**
   ```bash
   npm run build
   ```

---

## 📂 Project Structure

* `components/`: UI components like `Sidebar`, `MessageBubble`, and `GlossaryTooltip`.
* `services/`: Core logic, including `geminiService.ts` for AI model calls and memory RAG logic.
* `types/`: Shared TypeScript interfaces for chats, profiles, sessions, and gear data.
* `App.tsx`: Main application container, scroll coordination, and chat session orchestrations.
* `index.css`: Global design tokens, custom animation keys, scroll containment, and custom scrollbar overrides.

---

<div align="center">
Built for the community. Happy listening! 🎶
</div>
