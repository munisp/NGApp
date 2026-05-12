from http.server import HTTPServer, BaseHTTPRequestHandler
import json, os
class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        routes = {
            "/healthz": lambda: {"status":"healthy","service":"tax-reporting-py","port":PORT},
            "/api/tax-reporting/config": lambda: {"service":"Tax Reporting","port":PORT,"status":"active"},
            "/api/tax-reporting/middleware": lambda: {"kafka":{"topics":["tax-reporting.events"]},"dapr":{"stateStore":"tax-reporting-state"},"fluvio":{"topics":["tax-reporting-stream"]},"temporal":{"workflows":["tax-reporting-workflow"]},"postgres":{"tables":["tax-reporting_config"]},"keycloak":{"roles":["tax-reporting-admin"]},"permify":{"relations":["tax-reporting:can_manage"]},"redis":{"keys":["tax-reporting:cache"]},"mojaloop":{"oracle":"tax-reporting-oracle"},"opensearch":{"indices":["tax-reporting-events"]},"openappsec":{"policy":"tax-reporting-protection"},"apisix":{"route":"/api/tax-reporting/*"},"tigerbeetle":{"accounts":[]},"lakehouse":{"tables":["tax-reporting_analytics"]}},
        }
        handler = routes.get(self.path)
        if handler:
            self.send_response(200);self.send_header("Content-Type","application/json");self.end_headers()
            self.wfile.write(json.dumps(handler()).encode())
        else: self.send_response(404);self.end_headers()
    def log_message(self, *a): pass
PORT = int(os.environ.get("PORT", 8338))
print(f"Tax Reporting on :{PORT}")
HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
