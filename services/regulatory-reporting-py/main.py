"""
regulatory-reporting-py — Production service with Postgres SQL queries
"""
import os
import json
import time
import logging
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("regulatory-reporting-py")

DB_URL = os.environ.get("DATABASE_URL", "")
START_TIME = time.time()
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
        logger.info(f"Connected to Postgres")
        return db_conn
    except Exception as e:
        logger.warning(f"DB connection failed: {e}")
        return None

class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def send_json(self, code, data):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("X-Service", "regulatory-reporting-py")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()
        self.wfile.write(json.dumps(data, default=str).encode())

    def do_OPTIONS(self):
        self.send_json(200, {"status": "ok"})

    def do_GET(self):
        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)
        
        if parsed.path in ("/health", "/healthz"):
            conn = get_db()
            self.send_json(200, {
                "status": "healthy",
                "service": "regulatory-reporting-py",
                "database": "connected" if conn else "disconnected",
                "uptime": f"{time.time() - START_TIME:.0f}s",
                "table": "regulatory_reports",
            })
            return
        
        if parsed.path.endswith("/list"):
            page = int(qs.get("page", ["1"])[0])
            limit = int(qs.get("limit", ["20"])[0])
            search = qs.get("search", [""])[0]
            offset = (page - 1) * limit
            
            conn = get_db()
            if conn:
                try:
                    import psycopg2.extras
                    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
                    if search:
                        cur.execute(f"SELECT * FROM regulatory_reports WHERE report_id::text ILIKE %s ORDER BY report_id LIMIT %s OFFSET %s",
                                   (f"%{search}%", limit, offset))
                    else:
                        cur.execute(f"SELECT * FROM regulatory_reports ORDER BY report_id LIMIT %s OFFSET %s", (limit, offset))
                    items = cur.fetchall()
                    cur.execute(f"SELECT COUNT(*) FROM regulatory_reports")
                    total = cur.fetchone()["count"]
                    cur.close()
                    self.send_json(200, {"items": items, "total": total, "page": page, "limit": limit, "source": "database"})
                    return
                except Exception as e:
                    logger.warning(f"Query error: {e}")
                    try:
                        conn.rollback()
                    except:
                        pass
            
            self.send_json(200, {"items": [], "total": 0, "page": page, "limit": limit, "source": "no-db"})
            return
        
        if parsed.path.endswith("/stats"):
            conn = get_db()
            total = 0
            if conn:
                try:
                    import psycopg2.extras
                    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
                    cur.execute(f"SELECT COUNT(*) FROM regulatory_reports")
                    total = cur.fetchone()["count"]
                    cur.close()
                except Exception as e:
                    logger.warning(f"Stats error: {e}")
            self.send_json(200, {"total": total, "table": "regulatory_reports", "source": "database"})
            return
        
        self.send_json(404, {"error": "Not found"})

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length)) if length > 0 else {}
        body["created_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        self.send_json(201, {"created": True, "data": body})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8080"))
    server = HTTPServer(("0.0.0.0", port), Handler)
    logger.info(f"[regulatory-reporting-py] Starting on :{port}")
    server.serve_forever()
