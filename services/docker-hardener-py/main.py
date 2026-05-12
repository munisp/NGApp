import json, os
from http.server import HTTPServer, BaseHTTPRequestHandler

ITEMS = json.loads("""[
  {
    "id": "DH-001",
    "check": "Non-root User",
    "category": "container_runtime",
    "cisBenchmark": "4.1",
    "passingContainers": 254,
    "failingContainers": 12,
    "total": 266,
    "severity": "high",
    "remediationAction": "Add USER directive to Dockerfile",
    "status": "warning"
  },
  {
    "id": "DH-002",
    "check": "Read-only Root Filesystem",
    "category": "container_runtime",
    "cisBenchmark": "5.12",
    "passingContainers": 180,
    "failingContainers": 86,
    "total": 266,
    "severity": "medium",
    "remediationAction": "Add --read-only flag to docker run",
    "status": "warning"
  },
  {
    "id": "DH-003",
    "check": "No Privileged Containers",
    "category": "container_runtime",
    "cisBenchmark": "5.4",
    "passingContainers": 266,
    "failingContainers": 0,
    "total": 266,
    "severity": "critical",
    "remediationAction": "Remove --privileged flag",
    "status": "passed"
  },
  {
    "id": "DH-004",
    "check": "Resource Limits Set",
    "category": "container_runtime",
    "cisBenchmark": "5.10",
    "passingContainers": 200,
    "failingContainers": 66,
    "total": 266,
    "severity": "medium",
    "remediationAction": "Add memory and CPU limits",
    "status": "warning"
  },
  {
    "id": "DH-005",
    "check": "HEALTHCHECK Defined",
    "category": "dockerfile",
    "cisBenchmark": "4.6",
    "passingContainers": 254,
    "failingContainers": 12,
    "total": 266,
    "severity": "medium",
    "remediationAction": "Add HEALTHCHECK instruction",
    "status": "warning"
  }
]""")

MIDDLEWARE = json.loads("""{
  "kafka": {
    "broker": "kafka:9092",
    "topics": [
      "security.docker.hardener.py"
    ]
  },
  "redis": {
    "url": "redis://redis:6379/0"
  },
  "postgres": {
    "url": "postgresql://postgres:54bank@postgres:5432/banking"
  },
  "opensearch": {
    "url": "https://opensearch:9200"
  },
  "keycloak": {
    "issuer": "https://auth.54bank.app/realms/54bank"
  },
  "permify": {
    "endpoint": "permify:3476"
  },
  "dapr": {
    "appId": "docker-hardener-py"
  },
  "fluvio": {
    "endpoint": "fluvio:9003"
  },
  "temporal": {
    "namespace": "54bank-security"
  },
  "mojaloop": {
    "hub": "mojaloop:4000"
  },
  "tigerbeetle": {
    "cluster": "tigerbeetle:3000",
    "ledger": 27
  },
  "lakehouse": {
    "endpoint": "lakehouse:8080"
  },
  "apisix": {
    "admin": "apisix:9180"
  },
  "openappsec": {
    "endpoint": "openappsec:8090"
  }
}""")

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/healthz":
            self._json(200, {"service": "docker-hardener-py", "status": "healthy", "version": "1.0.0", "description": "Non-root enforcement, image vulnerability audit, seccomp profiles, AppArmor policies, CIS Docker Benchmark", "middleware": MIDDLEWARE})
        elif self.path == "/v1/docker-hardener/list":
            self._json(200, {"total": len(ITEMS), "hardening_checks": ITEMS})
        elif self.path == "/v1/docker-hardener/stats":
            status_map = {}
            for item in ITEMS:
                s = item.get("status", "unknown")
                status_map[s] = status_map.get(s, 0) + 1
            self._json(200, {"total": len(ITEMS), "byStatus": status_map})
        else:
            self._json(404, {"error": "not found"})

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length)) if length else {}
        ITEMS.append(body)
        self._json(201, body)

    def _json(self, code, data):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def log_message(self, format, *args):
        pass

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8502"))
    print(f"Docker Security Hardener listening on :{port}")
    HTTPServer(("0.0.0.0", port), Handler).serve_forever()
