# GoldFlow

A **private, single-customer, alert-only** AI gold analysis platform.

GoldFlow receives **live XAU/USD ticks directly from the customer's MetaTrader 5**
(via the GoldFlowEA, which POSTs to `/api/mt5`), computes technical indicators
(LSE supplies 1-minute candles), and combines them with user-uploaded chart
screenshots through a vision-capable AI over **OpenRouter** to produce a single
**BUY / SELL / WAIT** gold signal for the customer's iPhone.

**GoldFlow never executes trades.**

```text
MetaTrader 5 (GoldFlowEA) ──POST ticks──► GoldFlow Backend
                                                │
                     (user uploads chart screenshots for context)
                                                │
                                 ┌──────────────┴──────────────┐
                                 │  OpenRouter AI (vision)       │
                                 │  → single BUY/SELL/WAIT       │
                                 └──────────────┬──────────────┘
                                                ▼
                                        GoldFlow Website → iPhone
```

## Project structure

```text
backend/    Flask API + MT5 ingest + market data (LSE candles) + technical
            indicators + AI (OpenRouter) + signal engine + SQLite + WebSocket
frontend/   Responsive mobile-first React dashboard (built to dist/ and served
            by the backend; live updates over Socket.IO)
mt5/        GoldFlowEA.mq5 — the MT5 data sender (attach to the XAUUSD chart)
bookmap/    LEGACY GoldFlow Bookmap add-on (kept in repo, no longer used)
CUSTOMER_GUIDE.md  install guide
```

The live market feed is **MT5-primary**: the GoldFlowEA on the customer's
chart posts ticks to `/api/mt5`, which become the live price and status shown
on the dashboard. London Strategic Edge is used only to provide 1-minute
candles for indicators and as a fallback price if the MT5 feed goes stale.

## Backend API

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/mt5` | POST | Receive a live tick from the MT5 GoldFlowEA (primary feed) |
| `/api/market` | GET | Live XAU/USD quote + source status |
| `/api/indicators` | GET | Technical indicators (EMA, RSI, MACD, support/resistance) |
| `/api/signal` | GET | Current signal + strength (WAIT when market is stale) |
| `/api/analysis` | GET | Latest combined AI gold analysis |
| `/api/history` | GET | Signal history |
| `/api/analyze` | POST | Combine market + indicators + uploaded screenshots into one analysis |
| `/api/analyze-image` | POST | Analyse a single uploaded screenshot as chart context |
| `/api/status` | GET | Market / AI / server connection status |
| `/api/config` | GET | Public config (e.g. `auth_required`) |
| `/api/health` | GET | Server heartbeat |

Every uploaded screenshot is analysed **generically as a chart** (price action,
trend, structure) and folded into the single gold signal — GoldFlow does not
label screenshots by platform (MT5 / Bookmap, etc.).

If `GOLDFLOW_API_KEY` is set, protected POST endpoints require either:

```text
Authorization: Bearer GF_xxxxxxxxxxxxxxxxxxxxxxxxx
# or
X-GoldFlow-Key: GF_xxxxxxxxxxxxxxxxxxxxxxxxx
```

Never expose or commit the API key. Source it from the environment.

## Configuration

All credentials are read from the environment (or `.env`). See `.env.example`:

```text
GOLDFLOW_API_KEY        optional API key to protect POST endpoints
GOLDFLOW_DB             SQLite file path (default /tmp/goldflow.db)
MT5_SYMBOL              MT5 symbol used by the GoldFlowEA (default XAUUSD)
MARKET_PROVIDER         auto | mt5 | lse | simulated  (default auto = MT5-primary)
LSE_API_KEY             London Strategic Edge key for 1-minute candles (optional)
OPENROUTER_API_KEY      OpenRouter API key (the only AI provider)
OPENROUTER_MODEL        model id, e.g. minimax/minimax-m3:free
```

OpenRouter is the **only** AI provider. If the AI call fails, GoldFlow degrades
to the built-in deterministic `signal_engine` (labeled "signal-engine") — it
never falls back to another AI provider.

## Install the MT5 EA

1. Open `mt5/GoldFlowEA.mq5` in MetaEditor.
2. Set `InpServerURL` to your GoldFlow site base URL + `/api/mt5`.
3. Set `InpAPIKey` to your GoldFlow API key.
4. Compile.
5. MT5 -> Tools -> Options -> Expert Advisors -> enable **Allow WebRequest**
   and add the exact site URL (do not skip this).
6. Attach the EA to the XAUUSD chart. It sends ticks every `InpSendSeconds`
   and never trades.

## Run locally

```bash
pip install -r backend/requirements.txt
cp .env.example .env           # fill OPENROUTER_API_KEY (+ optional LSE_API_KEY)
python -m backend.app          # backend on http://localhost:8000
```

Send a test tick (mimics the EA):

```bash
curl -X POST http://localhost:8000/api/mt5 \
  -H "Authorization: Bearer <MY_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"symbol":"XAUUSD","bid":4432.0,"ask":4432.6,"h1_trend":"BULLISH"}'
```

Build the frontend (needed once, or when you change the UI):

```bash
cd frontend && npm install && npm run build
```

For live frontend development with hot reload:

```bash
cd frontend && npm run dev      # proxies /api and /socket.io to :8000
```

## Deploy to Render

A `render.yaml` is included. Create a web service from this repo; Render will:

1. `pip install -r backend/requirements.txt`
2. `cd frontend && npm install && npm run build`
3. serve with `gunicorn backend.app:app --workers 1 --threads 1`

Set these environment variables privately in Render:

```text
GOLDFLOW_DB=/tmp/goldflow.db
LSE_API_KEY=...
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=minimax/minimax-m3:free
```

## Important

- **Alert-only.** GoldFlow never opens, closes or modifies trades.
- MT5 is the primary live feed; LSE provides candles/fallback only.
- OpenRouter is the sole AI provider; failures degrade to the technical engine.
- Screenshots are analysed in-memory only and never persisted to disk.
- Stale market data (> 30 s, `GOLDFLOW_STALE_AFTER`) is surfaced as `STALE`
  and forces **WAIT** rather than a stale BUY/SELL.
- Test in a simulated/paper environment before relying on signals.
