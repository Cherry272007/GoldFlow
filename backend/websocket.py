"""WebSocket layer (Flask-SocketIO).

Pushes real-time market and analysis updates to the browser so the dashboard
does not need to refresh. Runs in long-polling/websocket mode depending on
what the hosting platform supports — the backend stays request-driven and no
external message broker is required.

Events emitted to clients:
  market_update  {market, indicators, signal}
  analysis_update {analysis}
"""

import threading
import time

from flask_socketio import SocketIO

socketio = SocketIO(async_mode="threading", cors_allowed_origins="*")

_running = threading.Event()


def init_socketio(app):
    socketio.init_app(app)


def _emit_market_update(market, indicators, signal):
    socketio.emit(
        "market_update",
        {"market": market, "indicators": indicators, "signal": signal},
    )


def _emit_analysis_update(analysis):
    socketio.emit("analysis_update", {"analysis": analysis})


def broadcast_market(market, indicators, signal):
    try:
        _emit_market_update(market, indicators, signal)
    except Exception:
        pass


def broadcast_analysis(analysis):
    try:
        _emit_analysis_update(analysis)
    except Exception:
        pass


def start_emitter(app, interval=5.0):
    """Background thread: push fresh snapshots every ``interval`` seconds."""

    def loop():
        while not _running.is_set():
            time.sleep(interval)
            try:
                store = app.config["GOLDFLOW"]
                store.market.tick()  # refresh LIVE / STALE / DOWN
                market = store.market.quote()
                indicators = store.technical.latest()
                signal = store.analysis.current_signal()
                broadcast_market(market, indicators, signal)
            except Exception:
                continue

    _running.clear()
    threading.Thread(target=loop, daemon=True, name="goldflow-websocket").start()


def stop_emitter():
    _running.set()


@socketio.on("connect")
def _on_connect(auth=None):
    # Immediately send the current snapshot on connect.
    from flask import current_app

    try:
        store = current_app.config["GOLDFLOW"]
        market = store.market.quote()
        indicators = store.technical.latest()
        signal = store.analysis.current_signal()
        _emit_market_update(market, indicators, signal)
    except Exception:
        pass
    return True


@socketio.on("refresh")
def _on_refresh(_data=None):
    from flask import current_app

    try:
        store = current_app.config["GOLDFLOW"]
        market = store.market.quote()
        indicators = store.technical.latest()
        signal = store.analysis.current_signal()
        _emit_market_update(market, indicators, signal)
    except Exception:
        pass