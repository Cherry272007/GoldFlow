"""Connection monitor.

Runs a low-frequency background thread that continuously evaluates
staleness so the dashboard reflects disconnections even while the sources
have stopped sending. On Render the process runs under gunicorn; one worker
is configured so a single monitor thread owns the state.
"""

import threading
import time


class ConnectionMonitor:
    def __init__(self, store, interval=1.0):
        self.store = store
        self.interval = interval
        self._stop = threading.Event()

    def start(self):
        threading.Thread(target=self._run, daemon=True, name="goldflow-monitor").start()

    def stop(self):
        self._stop.set()

    def _run(self):
        while not self._stop.is_set():
            try:
                self.store.tick()
            except Exception:
                pass
            self._stop.wait(self.interval)