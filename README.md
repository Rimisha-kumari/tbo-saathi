# TBO Saathi

An agentic, multilingual AI travel consultant with an expressive 3D avatar and a split-screen trip workspace. It speaks English, Hindi, Hinglish, Tamil, Telugu and Bengali.

## Run

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

- **Zero keys:** runs in **Smart Demo Mode**, a multi-turn rule-based brain that replies in all six languages, with browser voice in and out.
- **Live AI:** copy `.env.local` from `.env.example`, then set `ANTHROPIC_API_KEY` (Claude) or `OPENAI_API_KEY` (fallback).
- **Natural Indic voices:** set `SPEECH_PROVIDER=sarvam` with `SARVAM_API_KEY`, or the `BHASHINI_*` keys. If those fail, it falls back to the browser voice.

## Features

- **3D avatar:** a procedural Three.js character with blinking, dynamic brows, mouse-follow head, rim lighting, an aura that changes colour per state and real-time lip-sync. A **3D/2D** toggle switches to the 2D avatar, which also takes over automatically when WebGL isn't available.
- **True language switching:** typing or speaking in another language switches both the reply language and the voice locale.
- **Workspace tabs:**
  - **Compare:** side-by-side flights and hotels.
  - **Itinerary:** day by day, with weather badges and a budget meter.
  - **My Bookings:** QR vouchers to download or print, plus modify and cancel.
  - **Client Itinerary:** for B2B agents.
- **Traveller memory pills**, a **strict Confirm ✅ / Edit ✏️ gate** for every booking, cancellation and rescue, and **disruption rescue** that rebooks the flight and moves the cab and hotel check-in times.
- **B2B Agent Copilot:** net vs client price, an agency markup slider and a printable English client itinerary (PDF).
- **One-click demo bar:** Plan Goa in Hindi (₹50k) · Compare Hotels · Make it Cheaper · Simulate Flight Cancellation 🚨 · B2B Agent View.

Architecture, schemas, tools and guardrails are in [CLAUDE.md](./CLAUDE.md).
