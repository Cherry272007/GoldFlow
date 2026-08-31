# GoldFlow — Final Setup Guide

**(You do NOT need any coding skills. Follow the steps in order. Each step tells you what you should SEE, so you always know it worked.)**

GoldFlow watches the gold market for you. It reads prices from **MT5** and buying/selling pressure from **Bookmap**, combines them, and shows a simple answer on a website:

- **BUY** → it thinks gold will go UP
- **SELL** → it thinks gold will go DOWN
- **WAIT** → not sure yet, check again later

**Golden rule: GoldFlow only watches and alerts. It can never open, close, or change any trade. Your passwords stay secret and are never sent to GoldFlow. You log into MT5/Bookmap normally, like always.**

---

# When: every day (after setup)

Open these three, in this order, every trading session:

1. **MT5** → open it, make sure **GoldFlowEA** is running on the XAUUSD chart
2. **Bookmap** → open it, make sure it's connected with the GC (gold) chart open
3. **GoldFlow website** → open `https://goldflow-web-91fa.onrender.com` on your phone or browser

Then just read the page (see "How to read the website" below).

---

# FIRST TIME SETUP (only once)

## PART A — MT5 + your real account

**Install MT5** (if not already installed):
1. Go to `https://www.metatrader5.com/en/download` and download **MetaTrader 5 for macOS**.
2. Install it (click Next/Continue/Install; choose **Safari** when it asks for a browser).
3. Open **MetaTrader 5**.

**Log in with your REAL account:**
1. In MT5 press `Cmd + N` (Navigator opens on the left).
2. Click the small paper/person icon (or press `Cmd + I`).
3. Choose **your broker**, your account number, and type **your normal password** — exactly as you log in any day.
4. Click Login/OK.
5. **CHECK**: bottom of MT5 says **Connected**.

> Privacy: GoldFlow never sees your password. You type it only into MT5 itself.

## PART B — Install the GoldFlow EA (the important part)

You received ONE small file: **GoldFlowEA.ex5**. It goes into ONE folder. Do it with this method — it works every time (do NOT use drag-and-drop / copy-paste in Finder for this folder; macOS silently blocks it. We use Terminal instead, which is 100% reliable).

**Step B1 — put the file in Downloads.** Make sure `GoldFlowEA.ex5` is saved in your **Downloads** folder (from email/AirDrop/download). If it isn't, download it now.
- **CHECK**: in Finder → Downloads you can see `GoldFlowEA.ex5`.

**Step B2 — copy it into the MT5 Expert folder with ONE Terminal command.**

Open the **Terminal** app (press `Cmd + Space`, type `Terminal`, press Enter). Copy-paste this **one line** and press Enter:

```
cp ~/Downloads/GoldFlowEA.ex5 "$HOME/Library/Application Support/net.metaquotes.wine.metatrader5/drive_c/Program Files/MetaTrader 5/MQL5/Experts/" && echo COPY-OK
```

- **CHECK**: you see the word **`COPY-OK`** on the screen. That means the file is in the right place. (If instead you see an error like `No such file...`, download the file again so it's really in Downloads, then repeat this step.)

**Step B3 — make MT5 see it.**
1. Quit MT5 completely (`Cmd + Q`).
2. Reopen MT5.
3. Press `Cmd + N` → click the arrow next to **Expert Advisors**.
4. **CHECK**: **GoldFlowEA** is in the list. → Done. Continue to PART C.

*(To double-check the file is really there, paste into Terminal: `ls -la "$HOME/Library/Application Support/net.metaquotes.wine.metatrader5/drive_c/Program Files/MetaTrader 5/MQL5/Experts/"` and look for `GoldFlowEA.ex5`.)*

## PART C — Allow GoldFlow to talk to the internet (once)

1. MT5 top menu: **Tools** → **Options...**
2. Tab **Expert Advisors**.
3. Tick **Allow WebRequest for listed URL**.
4. Click **+** → type exactly: `https://goldflow-web-91fa.onrender.com` → **OK**.
5. Check it's in the list → **OK**.

## PART D — Turn on Algo Trading (once)

- Click the **Algo Trading** button in the MT5 toolbar until it's **ON** (looks pressed/highlighted). Shortcut: `Alt + T`.

## PART E — Put GoldFlow on the gold chart

1. `Cmd + N` to open Navigator.
2. Find **XAUUSD** (gold) in the Symbols list → double-click it (a gold chart opens).
3. In the Navigator, expand **Expert Advisors** → find **GoldFlowEA**.
4. **Drag GoldFlowEA onto the gold chart** → click **OK** when asked.
5. Top-right of the chart shows a small label **GoldFlowEA**. Attached!
6. Open the Experts log: in MT5 press `Cmd + T` (Toolbox) → tab **Experts**. You should see lines like `GoldFlow: HTTP 200` every ~2 seconds.
   - **CHECK**: `HTTP 200` = connected and working. Keep this chart open always.

---

## PART F — Bookmap

**Install Bookmap:**
1. Go to `https://bookmap.com` → **Download** → **macOS**.
2. Install it, open it, and register your free trial (name + email).

**Connect data:**
1. Connect **your real broker/data feed** (the one you use for Gold futures) in Bookmap's connections window. Wait for **Connected**.
   - If you have no feed yet, test with the free **Rithmic demo** (`https://rithmic.com`) — same steps below, just switch to your real feed later.

**Open the gold chart:**
1. Open instrument list → find **GC** (Gold futures) → open the GC chart.

**Turn on the GoldFlow add-on:**
1. Bookmap: **Settings** → **API plugins configuration**.
2. Click **Add...** → select the file **`GoldFlowBookmapAddon.jar`**.
3. **GoldFlow** appears → **tick the checkbox** to enable it.
4. Click the settings button next to it and enter these three things:

   - **API Key**: `GF_xxxxxxxxxxxxxxxxxxxxxxxxx`
   - **GoldFlow Server**: `https://goldflow-web-91fa.onrender.com`
   - **Instrument**: `GC`

5. Click **Save & Connect**.
6. **CHECK**: after a few seconds, reopen settings → status shows **connected**.

---

# HOW TO READ THE WEBSITE (daily)

| You see | It means |
| --- | --- |
| **BUY / SELL / WAIT** (big) | GoldFlow's current answer |
| **Signal Strength** | How strongly it believes (0–100%) |
| **MT5 Connected** | MT5 is sending live prices |
| **Bookmap Connected** | Bookmap is sending live flow |
| **Server Connected** | GoldFlow server reachable |
| **H1 Trend / M15 Structure** | Medium/short-term direction (BULLISH=up, BEARISH=down) |
| **Bookmap Flow** | BUYING=pushing up, SELLING=pushing down |
| **Bid / Ask** | Current gold prices |
| **Updated** | Last refresh time |

Rules:
- Green dots everywhere + a clear BUY/SELL = healthy. Signal Strength tells you how sure (87% = strong).
- **WAIT** = signals disagree or info is missing. Refresh later. Never force a trade.
- Pull down to refresh on your phone.

---

# PROBLEMS — quick fixes

**MT5 shows Disconnected on the website:**
1. Open MT5, check bottom says Connected; if not, **File → Login to Trade Account** → log in again.
2. Make sure the **XAUUSD chart with GoldFlowEA** is open and **Algo Trading** is ON.
3. `Cmd + T` → Experts → should show `GoldFlow: HTTP 200`.
4. Wait ~1 minute, refresh the page.

**Bookmap shows Disconnected:**
1. Open Bookmap → data feed **Connected**.
2. **GC chart** open.
3. Settings → API plugins → GoldFlow checkbox still **ticked**.
4. Wait ~1 minute, refresh.

**EA doesn't appear in MT5 after PART B:**
1. Rerun the PART B command — look for **`COPY-OK`**. If you get `No such file`, the file isn't in Downloads.
2. Quit and reopen MT5.
3. If still no GoldFlowEA, paste `ls -la ".../MQL5/Experts/"` in Terminal and confirm `GoldFlowEA.ex5` is listed.

**Website blank / won't load:**
- The free server sleeps when idle. Wait ~30 seconds, refresh. Check Wi-Fi. Try again.

**Always WAIT:**
- Normal when signals disagree. Keep watching; it changes. Don't enter trades just because you're impatient.

**If you ever reinstall MT5 or Bookmap**: redo Parts B, C, D, E (MT5) and the add-on steps (Bookmap). The two files and the API Key stay the same.

---

# Files & key (keep private — never post online)

- **`GoldFlowEA.ex5`** → copy into MT5's Experts folder (PART B)
- **`GoldFlowBookmapAddon.jar`** → load in Bookmap (PART F)
- **API Key** `GF_xxxxxxxxxxxxxxxxxxxxxxxxx` → only into the Bookmap GoldFlow settings

That's everything. Set up once, then just open MT5 + Bookmap + the website each day and read the signal.