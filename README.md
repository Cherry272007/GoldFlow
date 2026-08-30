# GoldFlow

A **private, single-customer, alert-only** gold analysis platform.

MT5 (XAUUSD) and Bookmap (order flow) send data to GoldFlow Cloud, which
combines it into **BUY / SELL / WAIT** alerts for the customer's iPhone.

**GoldFlow never executes trades.**

```text
MT5 (GoldFlowEA) ──HTTPS──► GoldFlow Cloud ──HTTPS──► Bookmap add-on
                                  │
                                  └──► GoldFlow Website ──► iPhone
```

## Project structure

```text
backend/    Flask API + signal engine + connection monitor + SQLite history
mt5/        GoldFlowEA.mq5  (MQL5, data transmission only)
bookmap/    GoldFlow Bookmap add-on (Java)
frontend/   Responsive React dashboard (built to dist/ and served by backend)
```

## Backend API

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/mt5` | POST | MT5 EA ingest |
| `/api/bookmap` | POST | Bookmap add-on ingest |
| `/api/status` | GET | MT5 / Bookmap / server connection status |
| `/api/signal` | GET | Current signal + strength |
| `/api/history` | GET | Signal transition history |
| `/api/health` | GET | Server heartbeat |

Authenticate every POST with:

```text
Authorization: Bearer GF_xxxxxxxxxxxxxxxxxxxxxxxxx
```

Never expose or commit the API key. Set it on Render as `GOLDFLOW_API_KEY`.

## Run locally

```bash
pip install -r backend/requirements.txt
GOLDFLOW_API_KEY=GF_dev_key_change_me python -m backend.app
```

Open http://localhost:8000 (dashboard) and post test data:

```bash
curl -X POST http://localhost:8000/api/mt5 \
  -H "Authorization: Bearer GF_dev_key_change_me" \
  -H "Content-Type: application/json" \
  -d '{"symbol":"XAUUSD","bid":3435.20,"ask":3435.45,"h1_trend":"BULLISH","m15_structure":"BULLISH"}'

curl -X POST http://localhost:8000/api/bookmap \
  -H "Authorization: Bearer GF_dev_key_change_me" \
  -H "Content-Type: application/json" \
  -d '{"instrument":"GC","price":3435.20,"delta":270,"flow":"BUYING","bid_volume":1250,"ask_volume":980}'
```

The dashboard also renders standalone when you rebuild the frontend:

```bash
cd frontend && npm install && npm run build
```

## Deploy to Render

1. Push this repo to GitHub (API key never in git).
2. Create a Render web service from the repo using `render.yaml`.
3. Copy the public URL.
4. In Render, set `GOLDFLOW_API_KEY` and keep it private.

## Install the MT5 EA

1. Open `mt5/GoldFlowEA.mq5` in MetaEditor.
2. Replace `InpServerURL` (exact site base URL + `/api/mt5`) and `InpAPIKey`.
3. Compile.
4. MT5 -> Tools -> Options -> Expert Advisors -> enable **Allow WebRequest** and add the exact site URL. This must not be bypassed.
5. Attach the EA to the XAUUSD chart.

## Install the Bookmap add-on

Wire `bookmap/GoldFlowBookmapAddon.java` listener bridges to the Bookmap
listeners your connection actually provides (BBO, trades, depth). Compile with
`javac *.java` and register the add-on with Bookmap. It sends the latest
snapshot to `/api/bookmap` at the configured update frequency.

## Important

- Alert-only. The EA and add-on never open, close or modify trades.
- Starter scoring thresholds, not a validated strategy.
- Verify what gold instrument Bookmap uses (e.g. `GC`) vs MT5 `XAUUSD`.
- Stale sources (> 30 s, tunable via `GOLDFLOW_STALE_AFTER`) force `WAIT`.
- Test in demo/simulation first.