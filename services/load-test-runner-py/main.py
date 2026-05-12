from http.server import HTTPServer, BaseHTTPRequestHandler
import json, os
class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        routes = {
            "/healthz": lambda: {"status":"healthy","service":"load-test-runner-py","port":PORT},
            "/api/load-tests/results": lambda: {
                "framework":"k6","scenarios":8,"total_vus_peak":500,
                "scenarios_list":[
                    {"name":"login_flow","vus":100,"duration":"5m","rps":450,"p50_ms":45,"p95_ms":120,"p99_ms":340,"errors":0.1,"status":"passed"},
                    {"name":"fund_transfer","vus":200,"duration":"10m","rps":890,"p50_ms":89,"p95_ms":250,"p99_ms":780,"errors":0.3,"status":"passed"},
                    {"name":"account_query","vus":500,"duration":"10m","rps":2400,"p50_ms":12,"p95_ms":45,"p99_ms":120,"errors":0.05,"status":"passed"},
                    {"name":"loan_origination","vus":50,"duration":"5m","rps":120,"p50_ms":340,"p95_ms":890,"p99_ms":2100,"errors":0.8,"status":"warning"},
                    {"name":"kyc_verification","vus":100,"duration":"5m","rps":280,"p50_ms":120,"p95_ms":450,"p99_ms":1200,"errors":0.2,"status":"passed"},
                    {"name":"gl_posting","vus":150,"duration":"10m","rps":670,"p50_ms":34,"p95_ms":89,"p99_ms":230,"errors":0.1,"status":"passed"},
                    {"name":"mojaloop_transfer","vus":80,"duration":"5m","rps":340,"p50_ms":180,"p95_ms":560,"p99_ms":1800,"errors":0.5,"status":"passed"},
                    {"name":"report_generation","vus":20,"duration":"3m","rps":45,"p50_ms":1200,"p95_ms":3400,"p99_ms":8900,"errors":1.2,"status":"failed"},
                ],
                "sla_compliance":{"p99_under_1s":6,"p99_under_3s":7,"p99_under_10s":8,"error_rate_under_1pct":7}
            },
            "/api/load-tests/middleware": lambda: {
                "kafka":{"topics":["loadtest.results","loadtest.metrics"]},"dapr":{"stateStore":"loadtest-state"},
                "fluvio":{"topics":["loadtest-events"]},"temporal":{"workflows":["loadtest-pipeline"]},
                "postgres":{"tables":["loadtest_results","loadtest_scenarios"]},"keycloak":{"roles":["loadtest-admin"]},
                "permify":{"relations":["loadtest:can_run"]},"redis":{"keys":["loadtest:status"]},
                "mojaloop":{"oracle":"loadtest-oracle"},"opensearch":{"indices":["loadtest-metrics"]},
                "openappsec":{"policy":"loadtest-protection"},"apisix":{"route":"/api/load-tests/*"},
                "tigerbeetle":{"accounts":[]},"lakehouse":{"tables":["loadtest_analytics"]}
            },
        }
        handler = routes.get(self.path)
        if handler:
            self.send_response(200);self.send_header("Content-Type","application/json");self.end_headers()
            self.wfile.write(json.dumps(handler()).encode())
        else: self.send_response(404);self.end_headers()
    def log_message(self, *a): pass
PORT = int(os.environ.get("PORT", 8325))
print(f"Load Test Runner on :{PORT}")
HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
