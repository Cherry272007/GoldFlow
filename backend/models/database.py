"""Signal / analysis history persistence.

Stores every AI analysis (and heuristic fallback) so the dashboard can show a
rolling history list. Uses SQLite (stdlib) so no extra runtime dependency is
needed. History is best-effort: a DB failure never breaks an analysis.
"""

import json
import sqlite3
import threading

SCHEMA = """
CREATE TABLE IF NOT EXISTS analysis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL,
    signal TEXT NOT NULL,
    confidence INTEGER NOT NULL,
    trend TEXT,
    risk TEXT,
    price REAL,
    reason TEXT,
    market_summary TEXT,
    support REAL,
    resistance REAL,
    provider TEXT,
    model TEXT,
    media TEXT,
    payload TEXT
);
"""

COLUMNS = (
    "ts", "signal", "confidence", "trend", "risk", "price", "reason",
    "market_summary", "support", "resistance", "provider", "model",
    "media", "payload",
)


class SignalHistory:
    def __init__(self, path, limit=500):
        self.limit = limit
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(path, check_same_thread=False)
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute(SCHEMA)
        self._conn.commit()
        self._prune()

    def add(self, record):
        row = {
            "ts": record.get("ts") or _now(),
            "signal": str(record.get("signal", "WAIT")).upper(),
            "confidence": int(record.get("confidence") or 0),
            "trend": record.get("trend"),
            "risk": record.get("risk"),
            "price": record.get("price"),
            "reason": record.get("reason"),
            "market_summary": record.get("market_summary"),
            "support": record.get("support"),
            "resistance": record.get("resistance"),
            "provider": record.get("provider"),
            "model": record.get("model"),
            "media": record.get("media"),
            "payload": json.dumps(record.get("payload") or record),
        }
        try:
            with self._lock:
                self._conn.execute(
                    "INSERT INTO analysis (%s) VALUES (%s)"
                    % (", ".join(COLUMNS), ", ".join("?" * len(COLUMNS))),
                    [row[k] for k in COLUMNS],
                )
                self._conn.commit()
        except sqlite3.Error:
            return
        self._prune()

    def recent(self, limit=200):
        rows = []
        try:
            with self._lock:
                self._conn.row_factory = sqlite3.Row
                rows = self._conn.execute(
                    "SELECT * FROM analysis ORDER BY id DESC LIMIT ?", (limit,)
                ).fetchall()
        except sqlite3.Error:
            return []
        cleaned = []
        for row in rows:
            item = dict(row)
            item.pop("id", None)
            _, item["signal"] = item["signal"], item["signal"]
            cleaned.append(item)
        return cleaned

    def count(self):
        try:
            with self._lock:
                row = self._conn.execute("SELECT COUNT(*) FROM analysis").fetchone()
                return row[0] if row else 0
        except sqlite3.Error:
            return 0

    def clear(self):
        try:
            with self._lock:
                self._conn.execute("DELETE FROM analysis")
                self._conn.commit()
        except sqlite3.Error:
            pass

    def _prune(self):
        try:
            with self._lock:
                self._conn.execute(
                    "DELETE FROM analysis WHERE id NOT IN "
                    "(SELECT id FROM analysis ORDER BY id DESC LIMIT ?)",
                    (self.limit,),
                )
                self._conn.commit()
        except sqlite3.Error:
            pass

    def close(self):
        try:
            with self._lock:
                self._conn.close()
        except sqlite3.Error:
            pass


def _now():
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat()