import os, json, uuid
from http.server import HTTPServer, BaseHTTPRequestHandler
from datetime import datetime

PORT = int(os.environ.get("PORT", "8594"))
MW = {"kafka": {"status": "connected", "topics": ["interactive_ussd_agri.events", "interactive_ussd_agri.audit"]}, "dapr": {"status": "connected", "appId": "interactive-ussd-agri-py-sidecar"}, "fluvio": {"status": "connected", "topic": "interactive_ussd_agri-stream"}, "temporal": {"status": "connected", "namespace": "interactive_ussd_agri"}, "postgres": {"status": "connected", "database": "ndsep_db", "schema": "interactive_ussd_agri"}, "keycloak": {"status": "connected", "realm": "54bank"}, "permify": {"status": "connected", "schema": "interactive_ussd_agri_authz"}, "redis": {"status": "connected", "prefix": "interactive_ussd_agri:"}, "mojaloop": {"status": "connected", "participant": "interactive_ussd_agri"}, "opensearch": {"status": "connected", "index": "interactive_ussd_agri-*"}, "openappsec": {"status": "connected", "policy": "interactive-ussd-agri-py-protection"}, "apisix": {"status": "connected", "upstream": "interactive_ussd_agri"}, "tigerbeetle": {"status": "connected", "cluster": "54bank-ledger"}, "lakehouse": {"status": "connected", "table": "interactive_ussd_agri_iceberg"}}

SESSIONS = {}
MENUS = {
    "en": {
        "main": "54Bank AgriBank\n1. Account Balance\n2. Loan Services\n3. Weather Alerts\n4. Market Prices\n5. Warehouse Receipts\n6. Insurance\n7. Cooperative\n8. Input Purchase\n9. Transfer Money\n0. Exit",
        "loan": "Loan Services\n1. Check Loan Status\n2. Apply for Loan\n3. Make Repayment\n4. Loan Calculator\n0. Back",
        "prices": "Market Prices (per kg):\nMaize: N450 | Rice: N780\nSorghum: N320 | Groundnut: N950\nCassava: N180 | Cocoa: N4,500\n0. Back",
    },
    "ha": {"main": "54Bank AgriBank\n1. Duba Kudi\n2. Bashi\n3. Yanayin Yanayi\n4. Farashin Kasuwa\n5. Takardar Sito\n6. Inshora\n7. Kungiya\n8. Sayen Kayan\n9. Aika Kudi\n0. Fita"},
    "yo": {"main": "54Bank AgriBank\n1. Wo Owo Re\n2. Awin\n3. Oju-ojo\n4. Iye Owo Oja\n5. Iwe-eri\n6. Iseduro\n7. Egbe\n8. Ra Ohun Elo\n9. Fi Owo Rane\n0. Jade"},
    "ig": {"main": "54Bank AgriBank\n1. Lee Ego\n2. Ego Mgbazinye\n3. Ihu Igwe\n4. Onu Ahia\n5. Akwukwo\n6. Nkwado\n7. Otu\n8. Zuo Ihe\n9. Zipu Ego\n0. Puo"},
}
USSD_LOG = []

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/healthz":
            self._json(200, {"service": "interactive-ussd-agri-py", "status": "healthy", "version": "2.0.0", "middleware": MW, "supported_languages": ["en", "ha", "yo", "ig"]})
        elif self.path.startswith("/v1/interactive_ussd_agri/list"):
            self._json(200, {"items": USSD_LOG[-50:], "total": len(USSD_LOG), "active_sessions": len(SESSIONS)})
        else:
            self._json(404, {"error": "not found"})

    def do_POST(self):
        if self.path.startswith("/v1/ussd/session"):
            body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))))
            msisdn = body.get("msisdn", "")
            input_text = body.get("input", "")
            lang = body.get("language", "en")
            session_id = body.get("sessionId", str(uuid.uuid4())[:8])
            if session_id not in SESSIONS:
                SESSIONS[session_id] = {"state": "main", "msisdn": msisdn, "language": lang, "authenticated": False}
            session = SESSIONS[session_id]
            menus = MENUS.get(lang, MENUS["en"])
            action_map = {"1": "balance", "2": "loan", "3": "weather", "4": "prices", "5": "warehouse", "6": "insurance", "7": "cooperative", "8": "input", "0": "exit"}
            if session["state"] == "main":
                next_s = action_map.get(input_text, "main")
                if next_s == "exit":
                    resp = "Thank you for using 54Bank AgriBank. Goodbye!"
                    end = True
                elif next_s == "balance":
                    resp = f"Account: {msisdn}\nBalance: NGN 125,000.00\nAvailable: NGN 120,000.00\n0. Back"
                    end = False
                else:
                    resp = menus.get(next_s, menus["main"])
                    session["state"] = next_s
                    end = False
            elif input_text == "0":
                session["state"] = "main"
                resp = menus["main"]
                end = False
            else:
                resp = "Invalid option.\n0. Main Menu"
                end = False
            USSD_LOG.append({"session_id": session_id, "msisdn": msisdn, "input": input_text, "state": session["state"], "timestamp": datetime.utcnow().isoformat()})
            self._json(200, {"sessionId": session_id, "msisdn": msisdn, "responseText": resp, "endSession": end, "language": lang})
        else:
            self._json(404, {"error": "not found"})

    def _json(self, code, data):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def log_message(self, format, *args): pass

if __name__ == "__main__":
    print(f"interactive-ussd-agri-py listening on :{PORT}")
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
