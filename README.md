# TBO Saathi

An agentic, multilingual AI travel consultant with a talking 2D avatar. It searches flights and hotels, builds an itinerary, books it with vouchers, and handles disruptions such as cancellations, delays and overbooking. It speaks English, Hindi, Tamil, Telugu and Bengali.

## Run

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

- **No keys needed.** Without `ANTHROPIC_API_KEY`, the app runs a rule-based offline demo agent over the same tools. Voice uses the browser's Web Speech API; Chrome or Edge is recommended for voice input.
- **Claude agent:** copy `.env.example` to `.env.local` and set `ANTHROPIC_API_KEY`.
- **Sarvam / Bhashini voices:** set `SPEECH_PROVIDER` and that provider's keys. If they're missing, it falls back to the browser voice.

## Demo flow

1. "Flights from Delhi to Goa next Friday for 2 people", then press **Select**.
2. "Hotel in Goa", then press **Choose**.
3. **Book trip**, then say "yes".
4. **Simulate a disruption** (Flight cancelled), then pick an option. Vouchers are reissued.

Architecture, data schemas and tool definitions are in [CLAUDE.md](./CLAUDE.md).
