from http.server import HTTPServer, BaseHTTPRequestHandler
import json, os
class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        routes = {
            "/healthz": lambda: {"status":"healthy","service":"api-analytics-py","port":PORT},
            "/api/api-analytics/config": lambda: {"service":"API Analytics","port":PORT,"status":"active"},
            "/api/api-analytics/middleware": lambda: {"kafka":{"topics":["api-analytics.events"]},"dapr":{"stateStore":"api-analytics-state"},"fluvio":{"topics":["api-analytics-stream"]},"temporal":{"workflows":["api-analytics-workflow"]},"postgres":{"tables":["api-analytics_config"]},"keycloak":{"roles":["api-analytics-admin"]},"permify":{"relations":["api-analytics:can_manage"]},"redis":{"keys":["api-analytics:cache"]},"mojaloop":{"oracle":"api-analytics-oracle"},"opensearch":{"indices":["api-analytics-events"]},"openappsec":{"policy":"api-analytics-protection"},"apisix":{"route":"/api/api-analytics/*"},"tigerbeetle":{"accounts":[]},"lakehouse":{"tables":["api-analytics_analytics"]}},
        }
        handler = routes.get(self.path)
        if handler:
            self.send_response(200);self.send_header("Content-Type","application/json");self.end_headers()
            self.wfile.write(json.dumps(handler()).encode())
        else: self.send_response(404);self.end_headers()
    def log_message(self, *a): pass
PORT = int(os.environ.get("PORT", 8340))
print(f"API Analytics on :{PORT}")
HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
