"""GoldFlow Flask application.

Serves:
  POST /api/mt5      MT5 EA ingest
  POST /api/bookmap  Bookmap add-on ingest
  GET  /api/status   connection status
  GET  /api/signal   current signal
  GET  /api/history  signal history
  /                  mobile dashboard (frontend/dist when built, else fallback)

Run locally:   python -m backend.app
Run on Render: gunicorn backend.app:app
"""

import os
from flask import Flask, jsonify, render_template_string, send_from_directory

from .config import (ALLOWED_BOOKMAP_SYMBOLS, ALLOWED_MT5_SYMBOLS, DB_PATH,
                     DEFAULT_SYMBOL, HISTORY_LIMIT, STALE_AFTER_SECONDS)
from .models.database import SignalHistory
from .routes import bookmap, mt5, signals, status
from .services.connection_monitor import ConnectionMonitor
from .services.signal_engine import SignalEngine
from .store import GoldFlowStore

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIST = os.path.normpath(os.path.join(BASE_DIR, "..", "frontend", "dist"))


def create_app():
    app = Flask(__name__)
    app.config["GOLDFLOW"] = _Config()
    app.config["GOLDFLOW_STORE"] = GoldFlowStore(
        SignalEngine(stale_after=STALE_AFTER_SECONDS),
        SignalHistory(DB_PATH, limit=HISTORY_LIMIT),
        DEFAULT_SYMBOL,
    )

    store = app.config["GOLDFLOW_STORE"]
    app.config["GOLDFLOW_MONITOR"] = ConnectionMonitor(store, interval=1.0)
    app.config["GOLDFLOW_MONITOR"].start()

    app.register_blueprint(mt5.bp)
    app.register_blueprint(bookmap.bp)
    app.register_blueprint(status.bp)
    app.register_blueprint(signals.bp)

    if os.path.isdir(FRONTEND_DIST):
        _mount_dist(app, FRONTEND_DIST)
    else:
        _mount_fallback(app)

    @app.route("/api/health")
    def health():
        return jsonify({"ok": True})

    return app


class _Config:
    DEFAULT_SYMBOL = DEFAULT_SYMBOL
    ALLOWED_MT5_SYMBOLS = ALLOWED_MT5_SYMBOLS
    ALLOWED_BOOKMAP_SYMBOLS = ALLOWED_BOOKMAP_SYMBOLS


def _mount_dist(app, dist):
    @app.get("/")
    def index():
        return send_from_directory(dist, "index.html")

    @app.errorhandler(404)
    def spa_fallback(path=None):
        return send_from_directory(dist, "index.html")


def _mount_fallback(app):
    @app.get("/")
    def fallback():
        return render_template_string(PAGE)


PAGE = r"""
<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#0d1520">
<title>GoldFlow</title>
<style>
 :root{--bg:#0d1520;--card:#151d2b;--line:#243041;--fg:#e8eef5;--muted:#8ca0b3;
       --ok:#21d07a;--bad:#ff4d5e;--wait:#ffb224}
 *{box-sizing:border-box}
 body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      background:var(--bg);color:var(--fg)}
 .wrap{max-width:560px;margin:auto;padding:18px}
 h1{font-size:20px;letter-spacing:.12em;margin:4px 0 16px}
 .card{background:var(--card);border:1px solid var(--line);border-radius:16px;
       padding:18px;margin:12px 0}
 .signal{font-size:52px;font-weight:800;text-align:center;margin:6px 0}
 .strength{text-align:center;font-size:18px;color:var(--muted)}
 progress{width:100%;height:14px;border:none;border-radius:8px;margin-top:10px}
 progress::-webkit-progress-bar{background:#0a1018;border-radius:8px}
 progress::-webkit-progress-value{border-radius:8px}
 .ok{color:var(--ok)}.bad{color:var(--bad)}.wait{color:var(--wait)}
 .dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px}
 table{width:100%;border-collapse:collapse}
 td{padding:7px 0;border-bottom:1px solid var(--line)}
 td:last-child{text-align:right}
 .muted{color:var(--muted);font-size:13px}
 .reason{color:var(--wait);text-align:center;margin-top:8px;font-size:14px}
</style>
</head>
<body>
<div class="wrap">
<h1>GOLDFLOW</h1>

<div class="card">
  <div id="signal" class="signal wait">WAIT</div>
  <div class="strength">Signal Strength <span id="confidence">0</span>%</div>
  <progress id="confbar" max="100" value="0"></progress>
  <div class="reason" id="reason"></div>
</div>

<div class="card">
  <table>
    <tr><td>MT5</td><td id="mt5status"><span class="dot wait"></span>Waiting</td></tr>
    <tr><td>Bookmap</td><td id="bmstatus"><span class="dot wait"></span>Waiting</td></tr>
    <tr><td>GoldFlow Server</td><td><span class="dot ok"></span>Connected</td></tr>
  </table>
</div>

<div class="card">
  <table>
    <tr><td>Symbol</td><td id="symbol">XAUUSD</td></tr>
    <tr><td>H1 Trend</td><td id="h1" class="wait">NEUTRAL</td></tr>
    <tr><td>M15 Structure</td><td id="m15" class="wait">NEUTRAL</td></tr>
    <tr><td>Bookmap Flow</td><td id="flow" class="wait">NEUTRAL</td></tr>
    <tr><td>Delta</td><td id="delta">0</td></tr>
    <tr><td>Bid</td><td id="bid">--</td></tr>
    <tr><td>Ask</td><td id="ask">--</td></tr>
    <tr><td>Updated</td><td id="updated">--</td></tr>
  </table>
</div>

<div class="card">
  <h3 style="margin:0 0 6px">History</h3>
  <div id="history" class="muted">No signals yet</div>
</div>

<p class="muted">Alert-only. GoldFlow does not place orders.</p>
</div>

<script>
function svc(label, cls){ return '<span class="'+cls+'">'+label+'</span>'; }
function colorize(val){
  if (val==='BULLISH'||val==='BUYING'||val==='BUY') return 'ok';
  if (val==='BEARISH'||val==='SELLING'||val==='SELL') return 'bad';
  return 'wait';
}
async function refresh(){
  const sig = await (await fetch('/api/signal')).json();
  const el=document.getElementById('signal');
  el.textContent=sig.signal;
  el.className='signal '+colorize(sig.signal);
  document.getElementById('confidence').textContent=sig.confidence;
  document.getElementById('confbar').value=sig.confidence;
  document.getElementById('reason').textContent=sig.reason||'';
  ['h1','m15','flow'].forEach(id=>{
    const map={h1:sig.h1_trend,m15:sig.m15_structure,flow:sig.bookmap_flow};
    const d=document.getElementById(id);
    d.textContent=map[id]||'NEUTRAL';
    d.className=colorize(map[id]);
  });
  document.getElementById('delta').textContent=sig.delta??0;
  document.getElementById('symbol').textContent=sig.symbol||'XAUUSD';
  document.getElementById('bid').textContent=sig.price??'--';
  document.getElementById('ask').textContent=sig.ask??'--';
  document.getElementById('updated').textContent=(sig.updated_at||'').slice(11,19)||'--';
  const st=await (await fetch('/api/status')).json();
  const m=st.mt5, b=st.bookmap, s=st.server;
  statusRow('mt5status',m.connected);
  statusRow('bmstatus',b.connected);
}
function statusRow(id, connected){
  const el=document.getElementById(id);
  el.innerHTML=connected?'<span class="dot ok"></span>Connected'
                        :'<span class="dot bad"></span>Disconnected';
}
async function history(){
  const h=await (await fetch('/api/history')).json();
  const box=document.getElementById('history');
  if(!h.history.length){box.textContent='No signals yet';return;}
  box.innerHTML=h.history.map(r=>
    '<div>'+(r.ts||'').slice(11,19)+' &nbsp; '+
    '<b class="'+colorize(r.signal)+'">'+r.signal+'</b> &nbsp; '+r.strength+'%</div>'
  ).join('');
}
refresh(); history(); setInterval(refresh,1000); setInterval(history,5000);
</script>
</body>
</html>
"""

app = create_app()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))