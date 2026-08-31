# AGENTS.md — GoldFlow

## 1. Project Overview

GoldFlow is a **private, single-customer, alert-only AI gold analysis platform**.

- Live XAU/USD ticks stream from the customer's **MetaTrader 5** via the
  **GoldFlowEA**, which POSTs to `/api/mt5` (the primary market feed).
- Technical indicators are computed from 1-minute candles (**London Strategic
  Edge** supplies candles; LSE also serves as a fallback price when MT5 is stale).
- The customer uploads **chart screenshots** (any platform) as context.
- A **vision-capable AI over OpenRouter** combines market + indicators +
  screenshots into a single **BUY / SELL / WAIT** signal.
- The customer views alerts on a **mobile-first web dashboard**.

**GoldFlow must never execute trades.**

---

## 2. Final Architecture

```text
MetaTrader 5 (GoldFlowEA) ──POST ticks──►  GoldFlow Backend (Flask)
        │                                    ├── MT5 ingest (/api/mt5, primary)
        │                                    ├── market data + indicators
        │                                    ├── OpenRouter AI (vision, only provider)
        │                                    ├── signal engine (deterministic fallback)
   (chart screenshots uploaded                  └── SQLite history + WebSocket
    for context)                                  │
                                                   ▼
                                        GoldFlow Website (React, mobile-first) → iPhone
```

The customer **uploads chart screenshots** directly in the browser. There is no
desktop connector, no Bookmap add-on, and no Python bridge in the running
system. The only code running on the customer's machine is the MT5 GoldFlowEA,
which sends data only.

---

## 3. Backend (Flask)

```text
backend/
├── app.py                 Flask factory, background threads, SPA mounting
├── config.py              env loading, certifi SSL fix, hosted secrets
├── market_data.py         MT5-primary client; LSE candles + fallback; LIVE/STALE/DOWN
├── indicators.py          pure indicator functions
├── signal_engine.py       deterministic BUY/SELL/WAIT (technical fallback)
├── image_analysis.py      base64 validation, downscale, in-memory privacy
├── websocket.py           Flask-SocketIO (market_update / analysis_update)
├── routes/
│   ├── analysis.py        /api/analyze, /api/analyze-image, /api/analysis, /api/config
│   ├── indicators.py      /api/indicators
│   ├── market.py          /api/market
│   ├── mt5.py             /api/mt5  (MT5 GoldFlowEA live tick ingest)
│   ├── signals.py         /api/signal, /api/history
│   └── status.py          /api/status
├── services/
│   ├── analysis_service.py  orchestrates AI + fallback + history; stale guard
│   └── technical.py         cached indicator engine
├── models/
│   └── database.py          SQLite signal history
├── ai/
│   ├── base.py              provider contract + normalization (flat gold analysis)
│   ├── signal_fallback.py   heuristic BUY/SELL/WAIT fallback
│   └── providers/
│       ├── base_provider.py
│       └── openrouter.py
└── requirements.txt
```

API:

```text
POST /api/mt5         MT5 GoldFlowEA live tick ingest (primary market feed)
GET  /api/market      live quote + source status
GET  /api/indicators  technical indicators
GET  /api/signal      current signal (forced WAIT when market is stale)
GET  /api/analysis    latest combined gold analysis
GET  /api/history     signal history
POST /api/analyze     combined analysis (market + indicators + screenshots)
POST /api/analyze-image single screenshot analysis
GET  /api/status      market / AI / server status
GET  /api/config      public config flags
```

---

## 4. Market Data — MT5 Primary, LSE Secondary

- **MT5 (primary):** `POST /api/mt5` receives a tick payload (`symbol/price/
  bid/ask/spread/timestamp/volume/h1_trend/m15_structure`) from the GoldFlowEA
  and applies it as the live quote + status.
- **LSE (secondary):** `lse-data` supplies 1-minute candles for the indicator
  engine. It also provides a fallback price if the MT5 feed is stale. Candles
  must use `order="desc"` then reverse (asc returns 2006 data).
- Market status: **LIVE** (tick < 30s), **STALE** (30s+, price still shown),
  **CONNECTING** (no tick yet).
- **Stale guard:** when status is not LIVE, `/api/signal` and
  `/api/analyze` output are forced to **WAIT** — never a stale BUY/SELL.

---

## 5. AI — OpenRouter Only

- **OpenRouter is the ONLY AI provider.** The abstraction stays extensible but
  there is **no provider fallback**.
- If the AI call fails, GoldFlow degrades to the **deterministic
  `signal_engine`** with `provider="signal-engine"` and a friendly `ai_error`.
  It never falls back to a second AI provider.
- One retry is attempted for transient errors before degrading.
- The AI returns a **flat gold analysis** — a single `signal` (BUY/SELL/WAIT),
  `confidence`, `trend`, `risk`, plus `observations` and a per-upload `images`
  status. **Screenshots are analysed generically as charts; the AI does not
  label platforms (MT5 / Bookmap, etc.).**
- Screenshots are passed to a vision-capable OpenRouter model
  (`OPENROUTER_MODEL`, default `minimax/minimax-m3:free`).
- Image analysis is **in-memory only** — screenshots are never written to disk.

---

## 6. Authentication & Security

- `GOLDFLOW_API_KEY` (if set) protects POST endpoints (`/api/mt5`,
  `/api/analyze`, `/api/analyze-image`) via either:
  ```text
  Authorization: Bearer GF_xxxxxxxxxxxxxxxxxxxxxxxxx
  X-GoldFlow-Key: GF_xxxxxxxxxxxxxxxxxxxxxxxxx
  ```
- Never expose the key in frontend JS, never commit it, never log it.
- `.env` and `.env.example` hold secrets. `.env` is gitignored.
- Never store broker/trading credentials. Alert-only: never place trades.
- macOS Python SSL is broken without `SSL_CERT_FILE=certifi.where()` (set in
  `config.py`).

---

## 7. Frontend (React + Vite)

```text
frontend/
├── index.html
├── vite.config.js        Tailwind + /api + /socket.io proxy
├── package.json
└── src/
    ├── App.jsx
    ├── main.jsx
    ├── index.css         Tailwind v4 + dark theme tokens
    ├── pages/Dashboard.jsx
    ├── services/api.js   REST + socket connect
    ├── services/format.js
    └── components/
        ├── Header.jsx            logo + market status pill
        ├── PriceCard.jsx         bid/ask/spread (MT5 source)
        ├── SignalCard.jsx        BUY/SELL/WAIT + confidence
        ├── MarketConditions.jsx  indicators table
        ├── ConnectionStatus.jsx  market / AI / server health
        ├── ScreenshotUploader.jsx drag/drop + tap to add
        ├── ScreenshotPreview.jsx thumbnails
        ├── ScreenshotAnalysis.jsx per-upload usable/note status
        ├── AIAnalysis.jsx        single gold analysis + observations
        └── SignalHistory.jsx     rolling history
```

- Live updates via Socket.IO (`market_update`, `analysis_update`), with a
  polling fallback when the socket is unavailable.
- Built to `frontend/dist/` and served by Flask. `npm run dev` for hot reload.

---

## 8. Stale Data Protection & Alert-Only Principle

- Stale/absent market data forces **WAIT**, never a fresh BUY/SELL (handled in
  `AnalysisService.current_signal` / `current_heuristic`).
- GoldFlow only ever: receive → analyze → calculate → alert → display.
- It never opens, closes, or modifies trades. The customer decides.

---

## 9. Render Deployment

- `render.yaml` builds backend deps then the frontend, and starts:
  ```text
  gunicorn backend.app:app --workers 1 --threads 1
  ```
  (single worker so background market/technical/websocket threads share state)
- Env: `GOLDFLOW_DB`, `LSE_API_KEY`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`
  (and optionally `GOLDFLOW_API_KEY`).

---

## 10. Definition of Done (web)

- [ ] Live XAU/USD from MT5 GoldFlowEA displayed on mobile dashboard.
- [ ] Technical indicators computed and shown (LSE candles).
- [ ] Screenshot upload + vision analysis (generic chart, no platform labels).
- [ ] OpenRouter-only AI signals with technical-engine degradation.
- [ ] Signal history persists in SQLite.
- [ ] Connection status for market / AI / server.
- [ ] Stale data forces WAIT.
- [ ] Works on iPhone (mobile-first).
- [ ] HTTPS + auth (when key set), no secrets committed.
- [ ] GoldFlow cannot place trades.

---

## 11. Legacy (kept in repo, not part of the running system)

- `bookmap/` — the old GoldFlow Bookmap add-on (Java). Not used.
- `CUSTOMER_GUIDE.md` — old install guide. Not used (see README instead).
