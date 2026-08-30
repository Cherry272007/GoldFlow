"""Signal history persistence.

Stores every signal transition so the dashboard can show a rolling
history list. Uses SQLite (stdlib) so no extra runtime dependency is
needed on Render.
"""

import sqlite3
import threading


SCHEMA = """
CREATE TABLE IF NOT EXISTS signals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL,
    symbol TEXT NOT NULL,
    signal TEXT NOT NULL,
    strength INTEGER NOT NULL,
    price REAL,
    h1_trend TEXT,
    m15_structure TEXT,
    bookmap_flow TEXT,
    delta REAL
);
"""

COLUMNS = ("ts", "symbol", "signal", "strength", "price",
           "h1_trend", "m15_structure", "bookmap_flow", "delta")


class SignalHistory:
    def __init__(self, path, limit=500):
        self.limit = limit
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(path, check_same_thread=False)
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute(SCHEMA)
        self._conn.commit()
        self._prune()

    def add(self, **row):
        row = {k: row.get(k) for k in COLUMNS}
        with self._lock:
            self._conn.execute(
                "INSERT INTO signals (%s) VALUES (%s)"
                % (", ".join(COLUMNS), ", ".join("?" * len(COLUMNS))),
                [row[k] for k in COLUMNS],
            )
            self._conn.commit()
        self._prune()

    def recent(self, limit=200):
        with self._lock:
            self._conn.row_factory = sqlite3.Row
            rows = self._conn.execute(
                "SELECT * FROM signals ORDER BY id DESC LIMIT ?", (limit,)
            ).fetchall()
            return [dict(r) for r in rows]

    def _prune(self):
        with self._lock:
            self._conn.execute(
                "DELETE FROM signals WHERE id NOT IN "
                "(SELECT id FROM signals ORDER BY id DESC LIMIT ?)",
                (self.limit,),
            )
            self._conn.commit()

    def close(self):
        with self._lock:
            self._conn.close()