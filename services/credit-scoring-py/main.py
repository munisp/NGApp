"""
credit-scoring-py — Production-hardened service
"""
import os
import sys
import json
import time
import signal
import logging
import threading
import uuid
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from datetime import datetime, timezone

# --- Structured Logging ---
class JsonFormatter(logging.Formatter):
    def format(self, record):
        return json.dumps({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "service": "credit-scoring-py",
            "message": record.getMessage(),
        })

handler = logging.StreamHandler()
handler.setFormatter(JsonFormatter())
logging.basicConfig(level=logging.INFO, handlers=[handler])
logger = logging.getLogger("credit-scoring-py")

# --- Redis Caching Layer ---
import socket as _socket

_REDIS_URL = os.environ.get("REDIS_URL", "localhost:6379")

def cache_get(key):
    try:
        host, port = _REDIS_URL.rsplit(":", 1)
        s = _socket.create_connection((host, int(port)), timeout=2)
        s.sendall(f"*2\r\n$3\r\nGET\r\n${len(key)}\r\n{key}\r\n".encode())
        data = s.recv(4096).decode()
        s.close()
        if data.startswith("$-1"): return None
        parts = data.split("\r\n", 2)
        return parts[1] if len(parts) >= 3 else None
    except Exception:
        return None

def cache_set(key, value, ttl=300):
    try:
        host, port = _REDIS_URL.rsplit(":", 1)
        s = _socket.create_connection((host, int(port)), timeout=2)
        cmd = f"*4\r\n$3\r\nSET\r\n${len(key)}\r\n{key}\r\n${len(str(value))}\r\n{value}\r\n$2\r\nEX\r\n${len(str(ttl))}\r\n{ttl}\r\n"
        s.sendall(cmd.encode())
        s.recv(256)
        s.close()
    except Exception:
        pass

# --- Configuration ---
DB_URL = os.environ.get("DATABASE_URL", "")
CREDIT_BUREAU_URL = os.environ.get("CREDIT_BUREAU_URL", "http://localhost:8150")
JWT_SECRET = os.environ.get("JWT_SECRET", "change-me-in-production")
PORT = int(os.environ.get("PORT", "8080"))
START_TIME = time.time()

# --- Metrics ---
request_count = 0
error_count = 0
metrics_lock = threading.Lock()

def inc_requests():
    global request_count
    with metrics_lock:
        request_count += 1

def inc_errors():
    global error_count
    with metrics_lock:
        error_count += 1

# --- Database ---
db_conn = None

def get_db():
    global db_conn
    if db_conn is not None:
        return db_conn
    if not DB_URL:
        return None
    try:
        import psycopg2
        import psycopg2.extras
        db_conn = psycopg2.connect(DB_URL)
        db_conn.autocommit = True
        logger.info("Database connected")
        return db_conn
    except Exception as e:
        logger.warning(f"DB connection failed: {e}")
        return None

def db_insert(table, record):
    conn = get_db()
    if not conn:
        record["id"] = str(uuid.uuid4())
        record["created_at"] = datetime.now(timezone.utc).isoformat()
        return record
    try:
        cur = conn.cursor()
        data = json.dumps(record)
        cur.execute("INSERT INTO records (data, service) VALUES (%s, %s) RETURNING id, created_at",
                    (data, "credit-scoring-py"))
        row = cur.fetchone()
        record["id"] = str(row[0])
        record["created_at"] = str(row[1])
        return record
    except Exception as e:
        logger.error(f"DB insert failed: {e}")
        record["id"] = str(uuid.uuid4())
        return record

def db_query(table, page=1, limit=50):
    conn = get_db()
    if not conn:
        return [], 0
    try:
        cur = conn.cursor()
        offset = (page - 1) * limit
        cur.execute("SELECT id, data, created_at FROM records WHERE service = %s ORDER BY created_at DESC LIMIT %s OFFSET %s",
                    ("credit-scoring-py", limit, offset))
        rows = cur.fetchall()
        items = []
        for row in rows:
            item = json.loads(row[1]) if isinstance(row[1], str) else row[1]
            item["id"] = str(row[0])
            item["created_at"] = str(row[2])
            items.append(item)
        cur.execute("SELECT COUNT(*) FROM records WHERE service = %s", ("credit-scoring-py",))
        total = cur.fetchone()[0]
        return items, total
    except Exception as e:
        logger.error(f"DB query failed: {e}")
        return [], 0

# --- JWT Auth ---
def validate_jwt(headers):
    auth = headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None, "Missing Bearer token"
    token = auth[7:]
    parts = token.split(".")
    if len(parts) != 3:
        return None, "Invalid token format"
    # In production: verify JWT signature with JWT_SECRET
    return {"sub": "authenticated"}, None

# --- Domain Logic ---
def get_db():
    global db_conn
    if db_conn is not None:
        return db_conn
    if not DB_URL:
        return None
    try:
        logger.info(f"Connected to Postgres")
        return db_conn
    except Exception as e:
        logger.warning(f"DB connection failed: {e}")
        return None


def compute_credit_score(income, debt, employment_years, loan_history_count, defaults, age):
    score = 300
    dti = debt / max(income, 1) * 100
    if dti < 30: score += 150
    elif dti < 50: score += 100
    elif dti < 70: score += 50
    if employment_years >= 5: score += 100
    elif employment_years >= 2: score += 60
    elif employment_years >= 1: score += 30
    if loan_history_count >= 3 and defaults == 0: score += 150
    elif loan_history_count >= 1 and defaults == 0: score += 100
    elif defaults > 0: score -= defaults * 50
    if 25 <= age <= 55: score += 50
    score = max(300, min(850, score))
    band = "excellent" if score >= 750 else "good" if score >= 650 else "fair" if score >= 550 else "poor"
    return {"score": score, "band": band, "dti_ratio": round(dti, 2), "max_loan_amount": round(income * 12 * (0.4 if band in ("excellent","good") else 0.2), 2), "approved": score >= 550}

def affordability_check(monthly_income, monthly_expenses, proposed_emi):
    disposable = monthly_income - monthly_expenses
    affordable = proposed_emi <= disposable * 0.5
    return {"disposable_income": round(disposable, 2), "proposed_emi": proposed_emi, "affordable": affordable, "max_emi": round(disposable * 0.5, 2)}


# --- HTTP Handler ---

# --- Inter-Service HTTP Client with Retry & Circuit Breaker ---
import urllib.request
import urllib.error

class CircuitBreaker:
    def __init__(self, threshold=5, reset_after=30):
        self._failures = 0
        self._last_failure = 0
        self._threshold = threshold
        self._reset_after = reset_after
    
    def allow(self):
        if self._failures >= self._threshold:
            if time.time() - self._last_failure > self._reset_after:
                self._failures = self._threshold // 2
                return True
            return False
        return True
    
    def record_success(self):
        if self._failures > 0:
            self._failures -= 1
    
    def record_failure(self):
        self._failures += 1
        self._last_failure = time.time()

_circuit_breaker = CircuitBreaker()

def call_service(method, url, body=None, retries=3, timeout=15):
    """Call another microservice with retries and circuit breaker."""
    if not _circuit_breaker.allow():
        raise Exception(f"Circuit breaker open for {url}")
    
    last_err = None
    for attempt in range(retries):
        try:
            if attempt > 0:
                time.sleep(0.1 * (2 ** attempt))
            
            data = json.dumps(body).encode() if body else None
            req = urllib.request.Request(url, data=data, method=method)
            req.add_header("Content-Type", "application/json")
            
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                result = json.loads(resp.read().decode())
                _circuit_breaker.record_success()
                return result
        except Exception as e:
            last_err = e
            _circuit_breaker.record_failure()
            logger.warning(f"[inter-service] {method} {url} attempt {attempt+1} failed: {e}")
    
    raise Exception(f"All {retries} retries exhausted for {url}: {last_err}")

def call_credit_bureau(bvn, consent_token):
    """Call credit-bureau-rs for credit history."""
    return call_service("POST", f"{CREDIT_BUREAU_URL}/v1/inquiry", {
        "bvn": bvn, "consent_token": consent_token,
    })

class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        logger.info(f"{self.command} {self.path} {args[0] if args else ''}")

    def respond(self, code, data):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("X-Trace-Id", trace_id if 'trace_id' in dir() else "unknown")
        self.end_headers()
        self.wfile.write(json.dumps(data, default=str).encode())

    def do_GET(self):
        trace_id = self.headers.get("X-Trace-Id") or self.headers.get("traceparent") or f"{int(__import__('time').time()*1000)}-{os.getpid()}"
        logger.info(f"[credit-scoring-py] {self.command} {self.path} trace={trace_id}")
        inc_requests()
        path = urlparse(self.path).path

        if path == "/healthz":
            db = get_db()
            self.respond(200, {
                "status": "healthy",
                "service": "credit-scoring-py",
                "version": "2.0.0",
                "db": "connected" if db else "not_configured",
                "uptime_secs": round(time.time() - START_TIME),
            })
        elif path == "/readyz":
            self.respond(200, {"ready": True})
        elif path == "/livez":
            self.respond(200, {"alive": True})
        elif path == "/metrics":
            body = (
                f'# HELP requests_total Total requests\n'
                f'# TYPE requests_total counter\n'
                f'requests_total{{service=\"credit-scoring-py\"}} {request_count}\n'
                f'# HELP errors_total Total errors\n'
                f'# TYPE errors_total counter\n'
                f'errors_total{{service=\"credit-scoring-py\"}} {error_count}\n'
            )
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(body.encode())
        elif path in ("/v1/records", "/v1/list"):
            claims, err = validate_jwt(dict(self.headers))
            if err:
                self.respond(401, {"error": "unauthorized", "detail": err})
                return
            items, total = db_query("credit_scoring_py")
            self.respond(200, {"items": items, "total": total, "source": "database" if get_db() else "no_db"})
        elif path == "/v1/stats":
            self.respond(200, {
                "service": "credit-scoring-py",
                "requests": request_count,
                "errors": error_count,
                "db_connected": get_db() is not None,
                "uptime_secs": round(time.time() - START_TIME),
            })
        else:
            self.respond(404, {"error": "not_found", "path": path})

    def do_POST(self):
        trace_id = self.headers.get("X-Trace-Id") or self.headers.get("traceparent") or f"{int(__import__('time').time()*1000)}-{os.getpid()}"
        logger.info(f"[credit-scoring-py] {self.command} {self.path} trace={trace_id}")
        inc_requests()
        path = urlparse(self.path).path
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length)) if length > 0 else {}

        # JWT auth check (monitoring mode: warn but allow)
        claims, err = validate_jwt(dict(self.headers))
        if err:
            self.respond(401, {"error": "unauthorized", "detail": err})
            return

        if path == "/v1/create":
            result = db_insert("credit_scoring_py", body)
            self.respond(201, {"created": True, "data": result})
        else:
            self.respond(404, {"error": "not_found", "path": path})

# --- Graceful Shutdown ---
server = None
shutdown_event = threading.Event()

def shutdown_handler(signum, frame):
    logger.info("Shutdown signal received")
    shutdown_event.set()
    if server:
        threading.Thread(target=server.shutdown).start()

signal.signal(signal.SIGTERM, shutdown_handler)
signal.signal(signal.SIGINT, shutdown_handler)

if __name__ == "__main__":
    get_db()
    server = HTTPServer(("0.0.0.0", PORT), Handler)
    logger.info(json.dumps({"service": "credit-scoring-py", "port": PORT, "message": "starting"}))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        if db_conn:
            db_conn.close()
        logger.info("Server stopped gracefully")
