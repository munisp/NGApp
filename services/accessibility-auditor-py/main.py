from http.server import HTTPServer, BaseHTTPRequestHandler
import json, os
class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        routes = {
            "/healthz": lambda: {"status":"healthy","service":"accessibility-auditor-py","port":PORT},
            "/api/accessibility-auditor/config": lambda: {"service":"Accessibility Auditor","port":PORT,"status":"active"},
            "/api/accessibility-auditor/middleware": lambda: {"kafka":{"topics":["accessibility-auditor.events"]},"dapr":{"stateStore":"accessibility-auditor-state"},"fluvio":{"topics":["accessibility-auditor-stream"]},"temporal":{"workflows":["accessibility-auditor-workflow"]},"postgres":{"tables":["accessibility-auditor_config"]},"keycloak":{"roles":["accessibility-auditor-admin"]},"permify":{"relations":["accessibility-auditor:can_manage"]},"redis":{"keys":["accessibility-auditor:cache"]},"mojaloop":{"oracle":"accessibility-auditor-oracle"},"opensearch":{"indices":["accessibility-auditor-events"]},"openappsec":{"policy":"accessibility-auditor-protection"},"apisix":{"route":"/api/accessibility-auditor/*"},"tigerbeetle":{"accounts":[]},"lakehouse":{"tables":["accessibility-auditor_analytics"]}},
        }
        handler = routes.get(self.path)
        if handler:
            self.send_response(200);self.send_header("Content-Type","application/json");self.end_headers()
            self.wfile.write(json.dumps(handler()).encode())
        else: self.send_response(404);self.end_headers()
    def log_message(self, *a): pass
PORT = int(os.environ.get("PORT", 8329))
print(f"Accessibility Auditor on :{PORT}")
HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
