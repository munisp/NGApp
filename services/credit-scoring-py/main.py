from http.server import HTTPServer, BaseHTTPRequestHandler
import json, os
class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        routes = {
            "/healthz": lambda: {"status":"healthy","service":"credit-scoring-py","port":PORT},
            "/api/credit-scoring/config": lambda: {"service":"Credit Scoring","port":PORT,"status":"active"},
            "/api/credit-scoring/middleware": lambda: {"kafka":{"topics":["credit-scoring.events"]},"dapr":{"stateStore":"credit-scoring-state"},"fluvio":{"topics":["credit-scoring-stream"]},"temporal":{"workflows":["credit-scoring-workflow"]},"postgres":{"tables":["credit-scoring_config"]},"keycloak":{"roles":["credit-scoring-admin"]},"permify":{"relations":["credit-scoring:can_manage"]},"redis":{"keys":["credit-scoring:cache"]},"mojaloop":{"oracle":"credit-scoring-oracle"},"opensearch":{"indices":["credit-scoring-events"]},"openappsec":{"policy":"credit-scoring-protection"},"apisix":{"route":"/api/credit-scoring/*"},"tigerbeetle":{"accounts":[]},"lakehouse":{"tables":["credit-scoring_analytics"]}},
        }
        handler = routes.get(self.path)
        if handler:
            self.send_response(200);self.send_header("Content-Type","application/json");self.end_headers()
            self.wfile.write(json.dumps(handler()).encode())
        else: self.send_response(404);self.end_headers()
    def log_message(self, *a): pass
PORT = int(os.environ.get("PORT", 8332))
print(f"Credit Scoring on :{PORT}")
HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
