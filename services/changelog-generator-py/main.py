from http.server import HTTPServer, BaseHTTPRequestHandler
import json, os
class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        routes = {
            "/healthz": lambda: {"status":"healthy","service":"changelog-generator-py","port":PORT},
            "/api/changelog-generator/config": lambda: {"service":"Changelog Generator","port":PORT,"status":"active"},
            "/api/changelog-generator/middleware": lambda: {"kafka":{"topics":["changelog-generator.events"]},"dapr":{"stateStore":"changelog-generator-state"},"fluvio":{"topics":["changelog-generator-stream"]},"temporal":{"workflows":["changelog-generator-workflow"]},"postgres":{"tables":["changelog-generator_config"]},"keycloak":{"roles":["changelog-generator-admin"]},"permify":{"relations":["changelog-generator:can_manage"]},"redis":{"keys":["changelog-generator:cache"]},"mojaloop":{"oracle":"changelog-generator-oracle"},"opensearch":{"indices":["changelog-generator-events"]},"openappsec":{"policy":"changelog-generator-protection"},"apisix":{"route":"/api/changelog-generator/*"},"tigerbeetle":{"accounts":[]},"lakehouse":{"tables":["changelog-generator_analytics"]}},
        }
        handler = routes.get(self.path)
        if handler:
            self.send_response(200);self.send_header("Content-Type","application/json");self.end_headers()
            self.wfile.write(json.dumps(handler()).encode())
        else: self.send_response(404);self.end_headers()
    def log_message(self, *a): pass
PORT = int(os.environ.get("PORT", 8327))
print(f"Changelog Generator on :{PORT}")
HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
