"""
credit-scoring-py — Production service with Postgres SQL queries
"""
import os
import json
import time
import logging
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("credit-scoring-py")

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


def compute_credit_score(income, debt, employment_years, loan_history_count, defaults, age):
    """Nigerian credit scoring model (CBN-aligned)"""
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
    """Check if borrower can afford the proposed EMI"""
    disposable = monthly_income - monthly_expenses
    affordable = proposed_emi <= disposable * 0.5
    return {"disposable_income": round(disposable, 2), "proposed_emi": proposed_emi, "affordable": affordable, "max_emi": round(disposable * 0.5, 2)}

class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def send_json(self, code, data):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("X-Service", "credit-scoring-py")
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
                "service": "credit-scoring-py",
                "database": "connected" if conn else "disconnected",
                "uptime": f"{time.time() - START_TIME:.0f}s",
                "table": "credit_scores",
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
                        cur.execute(f"SELECT * FROM credit_scores WHERE score_id::text ILIKE %s ORDER BY score_id LIMIT %s OFFSET %s",
                                   (f"%{search}%", limit, offset))
                    else:
                        cur.execute(f"SELECT * FROM credit_scores ORDER BY score_id LIMIT %s OFFSET %s", (limit, offset))
                    items = cur.fetchall()
                    cur.execute(f"SELECT COUNT(*) FROM credit_scores")
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
                    cur.execute(f"SELECT COUNT(*) FROM credit_scores")
                    total = cur.fetchone()["count"]
                    cur.close()
                except Exception as e:
                    logger.warning(f"Stats error: {e}")
            self.send_json(200, {"total": total, "table": "credit_scores", "source": "database"})
            return
        
        self.send_json(404, {"error": "Not found"})

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length)) if length > 0 else {}
        body["created_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        self.send_json(201, {"created": True, "data": body})



@app.route("/data")
def data_endpoint():
    """Query loans from Postgres."""
    db_url = os.environ.get("DATABASE_URL", "")
    if not db_url:
        return jsonify({"items": [], "source": "no-db"})
    try:
        import psycopg2
        from psycopg2.extras import RealDictCursor
        conn = psycopg2.connect(db_url)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        page = int(request.args.get("page", 1))
        limit = min(int(request.args.get("limit", 25)), 100)
        offset = (page - 1) * limit
        cur.execute('SELECT count(*) FROM "loans"')
        total = cur.fetchone()["count"]
        cur.execute('SELECT "loanId", "customerId", "principalAmount", status FROM "loans" ORDER BY id LIMIT %s OFFSET %s', (limit, offset))
        items = cur.fetchall()
        conn.close()
        return jsonify({"items": [dict(r) for r in items], "total": total, "page": page, "limit": limit, "source": "database"})
    except Exception as e:
        return jsonify({"items": [], "error": str(e), "source": "error"}), 200

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8080"))
    server = HTTPServer(("0.0.0.0", port), Handler)
    logger.info(f"[credit-scoring-py] Starting on :{port}")
    server.serve_forever()
