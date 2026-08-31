"""GoldFlow Flask application.

Serves:
  GET  /api/market       live XAU/USD quote + source status
  GET  /api/indicators   technical indicators
  GET  /api/signal       latest analysis signal
  GET  /api/analysis     latest combined analysis
  GET  /api/history      signal history
  POST /api/mt5          MT5 GoldFlowEA live tick ingest (primary market feed)
  POST /api/analyze      combined market + indicators + screenshots analysis
  POST /api/analyze-image single screenshot classification
  GET  /api/status       market / AI / server connection status
  /                       mobile-first dashboard (frontend/dist when built)

Run locally:   python -m backend.app
Run on Render: gunicorn backend.app:app   (single worker - background threads)
"""

import os
import threading
import time

from flask import Flask, jsonify, render_template_string, send_from_directory

from . import config
from .market_data import MarketDataClient
from .models.database import SignalHistory
from .models.push_store import PushStore
from .routes import analysis, chat, indicators, market, mt5, push, signals, status
from .services.analysis_service import AnalysisService
from .services.push_service import PushService
from .services.technical import TechnicalEngine
from .websocket import init_socketio, socketio, start_emitter

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIST = os.path.normpath(os.path.join(BASE_DIR, "..", "frontend", "dist"))


def create_app():
    app = Flask(__name__)
    app.config["GOLDFLOW"] = _build_store()
    store = app.config["GOLDFLOW"]

    init_socketio(app)
    _start_background(app)

    app.register_blueprint(market.bp)
    app.register_blueprint(mt5.bp)
    app.register_blueprint(indicators.bp)
    app.register_blueprint(signals.bp)
    app.register_blueprint(analysis.bp)
    app.register_blueprint(chat.bp)
    app.register_blueprint(status.bp)
    app.register_blueprint(push.bp)

    if os.path.isdir(FRONTEND_DIST):
        _mount_dist(app, FRONTEND_DIST)
    else:
        _mount_fallback(app)

    @app.route("/api/health")
    def health():
        return jsonify({"ok": True})

    return app


def _build_store():
    market_client = MarketDataClient()
    technical = TechnicalEngine(market_client)
    history = SignalHistory(config.DB_PATH, limit=config.HISTORY_LIMIT)
    push_service = PushService(PushStore(config.PUSH_STORE_PATH))
    analysis_service = AnalysisService(
        market_client, technical, history, push_service=push_service
    )
    return _Store(market_client, technical, analysis_service, push_service)


class _Store:
    def __init__(self, market, technical, analysis, push):
        self.market = market
        self.technical = technical
        self.analysis = analysis
        self.push = push
        self.history = analysis.history


def _start_background(app):
    store = app.config["GOLDFLOW"]
    store.market.start()
    store.technical.refresh()

    def technical_loop():
        while True:
            time.sleep(5)
            try:
                store.technical.refresh()
            except Exception:
                continue

    threading.Thread(
        target=technical_loop, daemon=True, name="goldflow-technical"
    ).start()
    start_emitter(app)


def _mount_dist(app, dist):
    @app.get("/")
    def index():
        return send_from_directory(dist, "index.html")

    # Serve a real static file from dist if it exists, otherwise fall back to
    # index.html so client-side routes work (single-page app).
    @app.get("/<path:filename>")
    def spa(filename):
        candidate = os.path.join(dist, filename)
        if os.path.isfile(candidate):
            return send_from_directory(dist, filename)
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
<meta name="theme-color" content="#0b111c">
<title>GoldFlow</title>
<style>
 :root{--bg:#0c0c0d;--card:#141415;--line:#2b2b2e;--fg:#ededf0;--muted:#a6a6b0;
       --ok:#10b981;--bad:#c0392b;--wait:#d4a017}
 *{box-sizing:border-box}
 body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      background:var(--bg);color:var(--fg)}
 .wrap{max-width:560px;margin:auto;padding:18px}
 h1{font-size:20px;letter-spacing:.14em;margin:4px 0 16px;color:var(--muted)}
 .card{background:var(--card);border:1px solid var(--line);border-radius:16px;
       padding:18px;margin:12px 0}
 .price{font-size:40px;font-weight:800}
 .signal{font-size:52px;font-weight:800;text-align:center;margin:6px 0}
 .strength{text-align:center;font-size:18px;color:var(--muted)}
 progress{width:100%;height:14px;border:none;border-radius:8px;margin-top:10px}
 progress::-webkit-progress-bar{background:#0a1018;border-radius:8px}
 .ok{color:var(--ok)}.bad{color:var(--bad)}.wait{color:var(--wait)}
 .dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px}
 table{width:100%;border-collapse:collapse}
 td{padding:7px 0;border-bottom:1px solid var(--line)}
 td:last-child{text-align:right}
 .muted{color:var(--muted);font-size:13px}
 .reason{color:var(--wait);text-align:center;margin-top:8px;font-size:14px}
 .footer{text-align:center;font-size:12px;color:var(--muted);margin:16px 0 24px}
</style>
</head>
<body>
<div class="wrap">
<h1>GOLDFLOW</h1>

<div class="card">
  <div class="muted">XAU/USD</div>
  <div class="price" id="price">--</div>
  <div id="change" class="muted">--</div>
  <div id="marketstatus"><span class="dot wait"></span>Connecting</div>
  <div class="muted" id="updated">--</div>
</div>

<div class="card">
  <div id="signal" class="signal wait">WAIT</div>
  <div class="strength">Confidence <span id="confidence">0</span>%</div>
  <progress id="confbar" max="100" value="0"></progress>
  <div class="muted" style="text-align:center">Trend <span id="trend">NEUTRAL</span> · Risk <span id="risk">--</span></div>
  <div class="reason" id="reason"></div>
</div>

<div class="card">
  <div style="font-weight:700;margin-bottom:6px">History</div>
  <div id="history" class="muted">No signals yet</div>
</div>

<p class="footer">Alert-only. GoldFlow never places orders. AI signals are not guarantees.</p>
</div>

<script>
function colorize(v){
  if(v==='BULLISH'||v==='BUY'||v==='LIVE')return 'ok';
  if(v==='BEARISH'||v==='SELL'||v==='DOWN')return 'bad';
  return 'wait';
}
function setRow(el,text,cls){el.textContent=text;el.className=cls;el.classList.add('dot');}
async function refresh(){
  try{
    const m=await (await fetch('/api/market')).json();
    const price=document.getElementById('price');
    price.textContent=m.price!=null?'$'+Number(m.price).toFixed(2):'--';
    const ch=document.getElementById('change');
    if(m.change_pct!=null){
      const up=m.change_pct>=0;
      ch.textContent=(up?'+':'')+Number(m.change_pct).toFixed(3)+'% ('+(up?'+':'')+Number(m.change).toFixed(2)+')';
      ch.className=up?'ok':'bad';
    } else ch.textContent='--';
    const st=document.getElementById('marketstatus');
    st.innerHTML='<span class="dot '+colorize(m.status)+'"></span>'+(m.status||'CONNECTING');
    document.getElementById('updated').textContent=m.timestamp?('Updated '+(m.timestamp||'').slice(11,19)):'--';
  }catch(e){}
  try{
    const s=await (await fetch('/api/signal')).json();
    const el=document.getElementById('signal');
    el.textContent=s.signal||'WAIT';
    el.className='signal '+colorize(s.signal);
    document.getElementById('confidence').textContent=s.confidence??0;
    document.getElementById('confbar').value=s.confidence??0;
    const t=document.getElementById('trend');t.textContent=s.trend||'NEUTRAL';t.className=colorize(s.trend);
    document.getElementById('risk').textContent=s.risk||'--';
    document.getElementById('reason').textContent=s.reason||'';
  }catch(e){}
  try{
    const h=await (await fetch('/api/history')).json();
    const box=document.getElementById('history');
    if(!h.history.length){box.textContent='No signals yet';return;}
    box.innerHTML=h.history.map(r=>
      '<div>'+(r.ts||'').slice(11,19)+' &nbsp; <b class="'+colorize(r.signal)+'">'+r.signal+'</b> &nbsp; '+r.confidence+'% &nbsp; <span class="muted">'+((r.sourceInfo||{}).name||r.provider||'')+'</span></div>'
    ).join('');
  }catch(e){}
}
refresh(); setInterval(refresh,3000);
</script>
</body>
</html>
"""

app = create_app()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "0.0.0.0")
    socketio.run(app, host=host, port=port, allow_unsafe_werkzeug=True)  # dev