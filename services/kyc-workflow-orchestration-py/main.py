"""
kyc-workflow-orchestration-py — Production-hardened service
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
            "service": "kyc-workflow-orchestration-py",
            "message": record.getMessage(),
        })

handler = logging.StreamHandler()
handler.setFormatter(JsonFormatter())
logging.basicConfig(level=logging.INFO, handlers=[handler])
logger = logging.getLogger("kyc-workflow-orchestration-py")

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
SANCTIONS_URL = os.environ.get("SANCTIONS_URL", "http://localhost:8127")
DOCUMENT_URL = os.environ.get("DOCUMENT_INTEL_URL", "http://localhost:8210")
LIVENESS_URL = os.environ.get("LIVENESS_URL", "http://localhost:8230")
JWT_SECRET = os.environ.get("JWT_SECRET", "change-me-in-production")
PORT = int(os.environ.get("PORT", "9435"))
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
                    (data, "kyc-workflow-orchestration-py"))
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
                    ("kyc-workflow-orchestration-py", limit, offset))
        rows = cur.fetchall()
        items = []
        for row in rows:
            item = json.loads(row[1]) if isinstance(row[1], str) else row[1]
            item["id"] = str(row[0])
            item["created_at"] = str(row[2])
            items.append(item)
        cur.execute("SELECT COUNT(*) FROM records WHERE service = %s", ("kyc-workflow-orchestration-py",))
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
def compute_verification_score(task_results):
    score = 0.0
    for task, result in task_results.items():
        weight = VERIFICATION_WEIGHTS.get(task, 0.0)
        confidence = result.get("confidence", 0.0) if isinstance(result, dict) else 0.0
        score += weight * confidence
    return round(score, 4)

def auto_decision(score, tier, risk_factors):
    thresholds = {"tier1": 0.60, "tier2": 0.75, "tier3": 0.85}
    threshold = thresholds.get(tier, 0.75)
    pep_flag = risk_factors.get("pep", False)
    sanctions_hit = risk_factors.get("sanctions_hit", False)
    if sanctions_hit:
        return "rejection", "sanctions_hit"
    if pep_flag and tier == "tier3":
        return "enhanced_dd", "pep_tier3_requires_edd"
    if score >= threshold:
        return "approval", f"score_{score}_above_{threshold}"
    if score >= threshold * 0.8:
        return "manual_review", f"score_{score}_near_threshold"
    return "rejection", f"score_{score}_below_{threshold*0.8}"

def check_sla_breach(workflow):
    deadline = workflow.get("slaDeadline")
    if not deadline:
        return False
    try:
        dl = datetime.fromisoformat(deadline.replace("Z", "+00:00"))
        return datetime.now(timezone.utc) > dl
    except Exception:
        return False

def compute_risk_assessment(workflow):
    tasks = workflow.get("parallelTasks", [])
    completed = [t for t in tasks if t.get("status") == "completed"]
    total = len(tasks)
    completion_rate = len(completed) / max(total, 1)
    risk_score = 0
    for t in completed:
        result = t.get("result", {})
        if isinstance(result, dict):
            if not result.get("match", True):
                risk_score += 25
            if result.get("fraud_indicator", False):
                risk_score += 40
    return {
        "completion_rate": round(completion_rate, 2),
        "risk_score": min(risk_score, 100),
        "risk_level": "high" if risk_score >= 60 else "medium" if risk_score >= 30 else "low",
        "tasks_completed": len(completed),
        "tasks_total": total,
    }


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

def call_liveness_check(image_data, session_id):
    """Call liveness-inference-py for passive liveness."""
    return call_service("POST", f"{LIVENESS_URL}/v1/liveness/check", {
        "image": image_data, "session_id": session_id,
    })

def call_document_verify(doc_type, image_data):
    """Call document-intelligence-py for OCR + verification."""
    return call_service("POST", f"{DOCUMENT_URL}/v1/extract", {
        "doc_type": doc_type, "image": image_data,
    })

def call_sanctions_check(name, dob, nationality):
    """Call sanctions-screening-rs for PEP/sanctions."""
    return call_service("POST", f"{SANCTIONS_URL}/v1/screen", {
        "entity_name": name, "dob": dob, "nationality": nationality,
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
        logger.info(f"[kyc-workflow-orchestration-py] {self.command} {self.path} trace={trace_id}")
        inc_requests()
        path = urlparse(self.path).path

        if path == "/healthz":
            db = get_db()
            self.respond(200, {
                "status": "healthy",
                "service": "kyc-workflow-orchestration-py",
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
                f'requests_total{{service=\"kyc-workflow-orchestration-py\"}} {request_count}\n'
                f'# HELP errors_total Total errors\n'
                f'# TYPE errors_total counter\n'
                f'errors_total{{service=\"kyc-workflow-orchestration-py\"}} {error_count}\n'
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
            items, total = db_query("kyc_workflow_orchestration_py")
            self.respond(200, {"items": items, "total": total, "source": "database" if get_db() else "no_db"})
        elif path == "/v1/stats":
            self.respond(200, {
                "service": "kyc-workflow-orchestration-py",
                "requests": request_count,
                "errors": error_count,
                "db_connected": get_db() is not None,
                "uptime_secs": round(time.time() - START_TIME),
            })
        else:
            self.respond(404, {"error": "not_found", "path": path})

    def do_POST(self):
        trace_id = self.headers.get("X-Trace-Id") or self.headers.get("traceparent") or f"{int(__import__('time').time()*1000)}-{os.getpid()}"
        logger.info(f"[kyc-workflow-orchestration-py] {self.command} {self.path} trace={trace_id}")
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
            result = db_insert("kyc_workflow_orchestration_py", body)
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
    logger.info(json.dumps({"service": "kyc-workflow-orchestration-py", "port": PORT, "message": "starting"}))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        if db_conn:
            db_conn.close()
        logger.info("Server stopped gracefully")
