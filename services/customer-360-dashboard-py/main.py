from http.server import HTTPServer, BaseHTTPRequestHandler
import json, os
class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        routes = {
            "/healthz": lambda: {"status":"healthy","service":"customer-360-dashboard-py","port":PORT},
            "/api/customer-360-dashboard/config": lambda: {"service":"Customer 360 Dashboard","port":PORT,"status":"active"},
            "/api/customer-360-dashboard/middleware": lambda: {"kafka":{"topics":["customer-360-dashboard.events"]},"dapr":{"stateStore":"customer-360-dashboard-state"},"fluvio":{"topics":["customer-360-dashboard-stream"]},"temporal":{"workflows":["customer-360-dashboard-workflow"]},"postgres":{"tables":["customer-360-dashboard_config"]},"keycloak":{"roles":["customer-360-dashboard-admin"]},"permify":{"relations":["customer-360-dashboard:can_manage"]},"redis":{"keys":["customer-360-dashboard:cache"]},"mojaloop":{"oracle":"customer-360-dashboard-oracle"},"opensearch":{"indices":["customer-360-dashboard-events"]},"openappsec":{"policy":"customer-360-dashboard-protection"},"apisix":{"route":"/api/customer-360-dashboard/*"},"tigerbeetle":{"accounts":[]},"lakehouse":{"tables":["customer-360-dashboard_analytics"]}},
        }
        handler = routes.get(self.path)
        if handler:
            self.send_response(200);self.send_header("Content-Type","application/json");self.end_headers()
            self.wfile.write(json.dumps(handler()).encode())
        else: self.send_response(404);self.end_headers()
    def log_message(self, *a): pass
PORT = int(os.environ.get("PORT", 8342))
print(f"Customer 360 Dashboard on :{PORT}")
HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
