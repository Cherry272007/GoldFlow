# AGENTS.md — GoldFlow

## 1. Project Overview

GoldFlow is a **private, single-customer, alert-only gold analysis platform**.

The customer uses:

* Their own MetaTrader 5 (MT5)
* Their own Bookmap
* GoldFlow web dashboard on their iPhone/browser

GoldFlow receives market data from MT5 and order-flow data from Bookmap, combines the information, and generates:

```text
BUY
SELL
WAIT
```

GoldFlow **must never execute trades**.

---

# 2. Final Architecture

Do **not** build a GoldFlow Connector desktop application.

Do **not** build a Python desktop bridge.

Do **not** require the customer to run Terminal commands.

The final architecture is:

```text
CUSTOMER MAC
────────────────────────────────────────

┌─────────────────┐
│      MT5        │
│    XAUUSD       │
└────────┬────────┘
         │
         │ GoldFlow EA
         │ HTTPS
         ▼
┌──────────────────────────┐
│                          │
│      GoldFlow Cloud      │
│       Flask Backend      │
│                          │
└──────────▲───────────────┘
           │
           │ HTTPS
           │
┌──────────┴───────────────┐
│         Bookmap          │
│                          │
│   GoldFlow Bookmap       │
│        Add-on            │
└──────────────────────────┘
```

The two local applications communicate directly with GoldFlow Cloud.

---

# 3. Customer Experience

The goal is:

```text
Customer opens MT5
        ↓
GoldFlow EA connected
        ↓
Customer opens Bookmap
        ↓
GoldFlow Add-on connected
        ↓
GoldFlow website
        ↓
BUY / SELL / WAIT
```

The customer should not need to:

```text
❌ Open Terminal
❌ Run Python commands
❌ Run scripts manually
❌ Install Python
❌ Install Node.js
❌ Use Git
❌ Run a localhost server
❌ Start a background connector
```

---

# 4. MT5 Integration

MT5 is the primary market-price source.

GoldFlow must use an MQL5 Expert Advisor:

```text
mt5/
└── GoldFlowEA.mq5
```

The EA reads market information from the customer's MT5 terminal.

The EA communicates with the GoldFlow backend using HTTPS and MQL5 `WebRequest()`.

MT5 requires the GoldFlow API URL to be explicitly allowed in:

```text
MT5
→ Tools
→ Options
→ Expert Advisors
→ Allow WebRequest for listed URL
```

This requirement must not be bypassed.

---

# 5. MT5 Data

Minimum required information:

```text
Symbol
Bid
Ask
Spread
Timestamp
H1 trend information
M15 structure information
```

Example:

```json
{
  "symbol": "XAUUSD",
  "bid": 3435.20,
  "ask": 3435.45,
  "spread": 0.25,
  "timestamp": 1756550000,
  "h1_trend": "BULLISH",
  "m15_structure": "BULLISH"
}
```

The exact fields can be expanded later.

---

# 6. MT5 Security

GoldFlow must never ask the customer for their MT5 password.

GoldFlow must never store:

```text
MT5 login password
Broker password
Trading account credentials
```

The customer logs into MT5 normally.

The EA only reads market information and sends the required data to GoldFlow.

---

# 7. MT5 Trading Restrictions

GoldFlow is strictly alert-only.

The EA must never:

```text
Open trades
Close trades
Modify trades
Modify stop loss
Modify take profit
Manage positions
```

Do not implement trading functions.

Do not use GoldFlow to automatically execute trades.

The EA's purpose is data transmission only.

---

# 8. Bookmap Integration

Do not build a separate GoldFlow Connector.

Build a native Bookmap add-on:

```text
bookmap/
└── GoldFlowBookmapAddon.java
```

The add-on runs inside Bookmap.

The add-on communicates directly with GoldFlow Cloud.

Architecture:

```text
Bookmap
   ↓
GoldFlow Bookmap Add-on
   ↓
HTTPS
   ↓
GoldFlow API
```

---

# 9. Bookmap API

Use Bookmap's supported developer API.

Where available, use appropriate Bookmap listeners such as:

```text
TradeDataListener
BboListener
DepthDataListener
MarketByOrderDepthDataListener
```

The exact listeners must depend on the data actually available from the customer's Bookmap connection.

Do not invent unsupported APIs.

Do not scrape the Bookmap UI.

Do not screen-read Bookmap.

Use the official supported integration/API mechanism.

---

# 10. Bookmap Data

The add-on should collect the order-flow information required by GoldFlow.

Potential fields:

```text
Symbol
Price
Bid
Ask
Bid volume
Ask volume
Trade volume
Delta
Flow
Depth
Liquidity
Timestamp
```

Example:

```json
{
  "symbol": "XAUUSD",
  "price": 3435.20,
  "bid_volume": 1250,
  "ask_volume": 980,
  "delta": 270,
  "flow": "BUYING",
  "timestamp": 1756550000
}
```

The actual payload must match the data available from the customer's Bookmap feed.

---

# 11. Important Bookmap Instrument Rule

Before implementation, verify exactly what gold instrument the customer's Bookmap uses.

Possible examples:

```text
XAUUSD
GC futures
Gold CFD
COMEX Gold
```

These are not automatically the same market.

The system must not assume that Bookmap's gold instrument is identical to MT5 XAUUSD.

The instrument mapping must be explicitly configured.

Example:

```text
MT5:
XAUUSD

Bookmap:
GC
```

If they represent different markets, the signal engine must account for that difference.

---

# 12. Bookmap Add-on UI

The add-on should provide a simple configuration interface.

Example:

```text
GoldFlow

API Key
[ **************** ]

GoldFlow Server
[ https://api.goldflow.com ]

Instrument
[ GC / XAUUSD ]

Data
☑ Trades
☑ BBO
☑ Depth

Update Frequency
[ 250 ms ]

[ CONNECT ]
```

After connection:

```text
GoldFlow

🟢 Connected

Instrument
GC

Sending data
🟢

Last update
1 ms ago
```

The UI must be simple enough for the customer to configure without technical knowledge.

---

# 13. Bookmap API Client

Create:

```text
bookmap/
├── GoldFlowBookmapAddon.java
├── GoldFlowApiClient.java
├── GoldFlowSettings.java
├── GoldFlowDataProcessor.java
└── GoldFlowConnection.java
```

Responsibilities:

### GoldFlowBookmapAddon

Initializes the Bookmap add-on.

### GoldFlowApiClient

Handles:

```text
HTTPS
Authentication
POST requests
Connection errors
Retries
```

### GoldFlowSettings

Stores:

```text
API key
Server URL
Instrument
Update frequency
Data settings
```

### GoldFlowDataProcessor

Converts Bookmap events into the GoldFlow data format.

### GoldFlowConnection

Handles:

```text
Connect
Disconnect
Reconnect
Heartbeat
Status
```

---

# 14. Backend

The GoldFlow backend uses Flask.

Minimum API:

```text
POST /api/mt5
POST /api/bookmap

GET /api/status
GET /api/signal
GET /api/history
```

---

# 15. MT5 Endpoint

```text
POST /api/mt5
```

Responsibilities:

```text
Authenticate
Validate payload
Validate symbol
Validate timestamp
Update MT5 state
Update last-seen time
```

---

# 16. Bookmap Endpoint

```text
POST /api/bookmap
```

Responsibilities:

```text
Authenticate
Validate payload
Validate instrument
Validate timestamp
Update Bookmap state
Update last-seen time
```

---

# 17. Authentication

This is a single-customer private system.

Use a private GoldFlow API key.

Example:

```text
GF_xxxxxxxxxxxxxxxxxxxxxxxxx
```

Requests should authenticate using:

```text
Authorization: Bearer GF_xxxxxxxxxxxxxxxxx
```

Never expose the API key in frontend JavaScript.

Never commit the API key to Git.

Never print the API key in logs.

---

# 18. Data State

The backend should maintain the latest state from both sources.

Example:

```text
MT5 State
────────────────
symbol
bid
ask
spread
h1_trend
m15_structure
timestamp
last_seen

Bookmap State
────────────────
symbol
price
bid_volume
ask_volume
delta
flow
timestamp
last_seen
```

---

# 19. Signal Engine

The signal engine combines:

```text
MT5
├── Price
├── H1 trend
└── M15 structure

+

Bookmap
├── Order flow
├── Delta
├── Bid volume
├── Ask volume
└── Liquidity/depth
```

Output:

```text
BUY
SELL
WAIT
```

Example:

```text
H1 = BULLISH
M15 = BULLISH
Bookmap = BUYING
Delta = POSITIVE

        ↓

      BUY
```

Conflicting or missing information should produce:

```text
WAIT
```

---

# 20. Stale Data Protection

Never generate a current BUY or SELL signal from stale data.

Each data source must have a `last_seen` timestamp.

Example:

```text
MT5:
Last update = 2 seconds ago
→ Connected

Bookmap:
Last update = 3 seconds ago
→ Connected
```

If required data becomes stale:

```text
MT5:
Last update = 60 seconds ago
→ Disconnected
```

Signal:

```text
🟡 WAIT

Reason:
MT5 data unavailable
```

---

# 21. Signal History

Store:

```text
timestamp
symbol
signal
strength
price
h1_trend
m15_structure
bookmap_flow
delta
```

Example:

```text
19:24   BUY    87%
19:18   BUY    82%
19:10   WAIT   51%
18:56   SELL   79%
```

---

# 22. Dashboard

The customer accesses GoldFlow from an iPhone/browser.

Main dashboard:

```text
GOLDFLOW

XAUUSD

🟢 BUY

Signal Strength
87%

────────────────────

MT5
🟢 Connected

Bookmap
🟢 Connected

────────────────────

H1 Trend
BULLISH

M15 Structure
BULLISH

Bookmap Flow
BUYING

Bid
3435.20

Ask
3435.45

Updated
19:24:31
```

The dashboard must be responsive and mobile-first.

---

# 23. Connection Status

Dashboard should show:

```text
MT5
🟢 Connected

Bookmap
🟢 Connected

GoldFlow Server
🟢 Connected
```

If one source disconnects:

```text
MT5
🔴 Disconnected

Bookmap
🟢 Connected

Signal
🟡 WAIT
```

---

# 24. GoldPrice.org

Do not automatically scrape:

```text
https://goldprice.org/live-gold-price.html
```

unless GoldPrice.org provides permission/licensed access for automated data use.

For the current GoldFlow architecture, MT5 provides the primary XAUUSD market price.

GoldPrice.org can remain a reference website/link for the customer if desired.

---

# 25. No Desktop Connector

The following components are intentionally NOT part of the final architecture:

```text
❌ GoldFlow Connector.app
❌ PyInstaller connector
❌ Python background service
❌ localhost bridge
❌ macOS auto-start connector
❌ Terminal-based customer setup
```

The integrations are:

```text
MT5
 ↓
GoldFlow EA
 ↓
GoldFlow Cloud

Bookmap
 ↓
GoldFlow Bookmap Add-on
 ↓
GoldFlow Cloud
```

---

# 26. Recommended Project Structure

```text
goldflow/
│
├── backend/
│   ├── app.py
│   ├── config.py
│   ├── requirements.txt
│   │
│   ├── routes/
│   │   ├── mt5.py
│   │   ├── bookmap.py
│   │   ├── status.py
│   │   └── signals.py
│   │
│   ├── services/
│   │   ├── signal_engine.py
│   │   └── connection_monitor.py
│   │
│   └── models/
│       └── database.py
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── App.jsx
│   └── package.json
│
├── mt5/
│   └── GoldFlowEA.mq5
│
├── bookmap/
│   ├── GoldFlowBookmapAddon.java
│   ├── GoldFlowApiClient.java
│   ├── GoldFlowSettings.java
│   ├── GoldFlowDataProcessor.java
│   └── GoldFlowConnection.java
│
├── .gitignore
├── AGENTS.md
└── README.md
```

---

# 27. Development Order

## Phase 1 — Flask Backend

Build and test:

```text
POST /api/mt5
POST /api/bookmap
GET /api/status
GET /api/signal
GET /api/history
```

---

## Phase 2 — MT5 EA

Build:

```text
GoldFlowEA.mq5
```

Test:

```text
MT5
 ↓
GoldFlow EA
 ↓
GoldFlow API
```

Verify:

* Bid
* Ask
* XAUUSD
* Timestamp
* H1
* M15

---

## Phase 3 — Bookmap Add-on

Build the native Bookmap add-on.

Test:

```text
Bookmap
 ↓
GoldFlow Add-on
 ↓
GoldFlow API
```

Verify the exact available data before implementing signal logic.

---

## Phase 4 — Signal Engine

Combine:

```text
MT5
+
Bookmap
```

and produce:

```text
BUY
SELL
WAIT
```

---

## Phase 5 — Dashboard

Build the responsive mobile dashboard.

---

## Phase 6 — Customer Installation

Prepare:

```text
GoldFlowEA.ex5
GoldFlow Bookmap Add-on
```

The customer should have a simple installation/configuration process.

---

# 28. Error Handling

The system must gracefully handle:

```text
MT5 disconnected
Bookmap disconnected
Internet disconnected
GoldFlow server unavailable
Invalid API key
Invalid payload
Unsupported instrument
Stale data
Bookmap feed unavailable
```

The customer should receive understandable messages.

Do not expose technical stack traces to the customer.

---

# 29. Security

Always:

* HTTPS
* API authentication
* Input validation
* Timestamp validation
* Secure secret storage
* No credentials in logs
* No secrets in Git
* Rate limiting where appropriate
* Stale-data protection

Never:

* Store MT5 passwords
* Execute trades
* Bypass MT5 security
* Scrape Bookmap
* Scrape GoldPrice.org without permission
* Expose API keys publicly

---

# 30. Alert-Only Principle

GoldFlow is an analysis and alert system.

It does:

```text
Receive
 ↓
Analyze
 ↓
Calculate
 ↓
Alert
 ↓
Display
```

It does not:

```text
Open trade
Close trade
Modify trade
Manage position
```

The customer makes the final trading decision.

---

# 31. Definition of Done

GoldFlow v1 is complete when:

* [ ] MT5 EA sends XAUUSD data to GoldFlow.
* [ ] Bookmap Add-on sends supported order-flow data to GoldFlow.
* [ ] No GoldFlow desktop Connector is required.
* [ ] Customer does not need Terminal.
* [ ] Customer does not need Python.
* [ ] Customer does not run commands.
* [ ] MT5 connection status works.
* [ ] Bookmap connection status works.
* [ ] Server connection status works.
* [ ] Stale data is detected.
* [ ] Signal engine produces BUY / SELL / WAIT.
* [ ] Signal history works.
* [ ] Dashboard works on iPhone.
* [ ] HTTPS is enabled.
* [ ] API authentication works.
* [ ] MT5 passwords are never stored.
* [ ] GoldFlow cannot place trades.

---

# 32. Final Architecture Principle

Keep GoldFlow as simple as possible.

```text
                 GOLDFLOW CLOUD
                ┌───────────────┐
                │ Flask Backend │
                │ Signal Engine │
                └───────┬───────┘
                        │
             ┌──────────┴──────────┐
             │                     │
          MT5 API             Bookmap API
             ▲                     ▲
             │                     │
      GoldFlow EA          GoldFlow Add-on
             ▲                     ▲
             │                     │
            MT5                 Bookmap


                        │
                        ▼
                GoldFlow Website
                        │
                        ▼
                    iPhone
```

**No Connector.**

**No desktop bridge.**

**No Python commands for the customer.**

**MT5 and Bookmap communicate directly with GoldFlow Cloud.**

The customer installs the two integrations once, connects them, and then uses the GoldFlow website for the alerts.