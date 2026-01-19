<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

# 🎧 AudioSage: Audiophile Research Assistant

**The ultimate AI companion for audiophiles and IEM enthusiasts.**
</div>

---

## ✨ Overview

AudioSage is a high-performance, AI-driven assistant designed to help audiophiles make better gear decisions. Leveraging the power of Google's **Gemini 3 Flash**, it provides deep technical analysis, personalized EQ recommendations, and real-time product comparisons.

Whether you're looking for your next pair of IEMs or trying to tune your current setup to the **Crinacle IEF Preference 2025** target, AudioSage has you covered.

## 🚀 Key Features

- **⚔️ Battle Mode**: Side-by-side technical comparisons between audio gear with AI-powered verdict and spec research.
- **📈 Visual EQ Analysis**: Upload frequency response graphs, and AudioSage will calculate precise gain offsets to match your target.
- **📱 Wavelet Integration**: Automatically generates 9-band fixed EQ presets (GraphicEQ) and preamp values for the Wavelet Android app.
- **🧠 Personalized RAG Knowledge Base**: Remembers your sound preferences, sensitive frequencies (e.g., 8kHz sibilance), and gear history to provide increasingly accurate advice.
- **🎙️ Voice & Image Support**: Interact via voice commands or upload measurements directly for analysis.
- **🔬 Advanced Engineering Mode**: Toggle technical depth for detailed discussions on Group Delay, Impulse Response, and more.

## 🛠️ Tech Stack

- **Frontend**: [React 19](https://react.dev/), [Vite](https://vitejs.dev/), [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **AI Engine**: [Google Gemini SDK](https://ai.google.dev/) (Gemini 3 Flash / 2.5 Flash Fallback)
- **Search**: Integrated Google Search Grounding for real-time spec verification.

## 📦 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (Latest LTS recommended)
- A [Gemini API Key](https://ai.google.dev/) (Get it from Google AI)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/audiosage.git
   cd audiosage
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment:**
   Create a `.env.local` file in the root directory and add your API key:
   ```env
   GEMINI_API_KEY=your_actual_api_key_here
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```

## 📂 Project Structure

- `components/`: UI components like `Sidebar`, `MessageBubble`, and `SettingsModal`.
- `services/`: Core logic, including `geminiService.ts` for AI orchestrations.
- `types.ts`: Shared TypeScript interfaces for chats, profiles, and gear.
- `App.tsx`: Main application entry point and state management.

## 🤝 Contributing

Contributions are welcome! If you have ideas for new features or improvements to the tuning algorithms, feel free to open an issue or submit a pull request.

---

<div align="center">
Built for the community. Happy listening! 🎶
</div>
