import json, os
from http.server import HTTPServer, BaseHTTPRequestHandler

ITEMS = json.loads("""[
  {
    "id": "NP-001",
    "name": "core-banking-ingress",
    "namespace": "banking",
    "podSelector": "app=core-banking-go",
    "ingressRules": [
      {
        "from": "app=api-gateway",
        "ports": [
          8100
        ]
      }
    ],
    "egressRules": [
      {
        "to": "app=postgres",
        "ports": [
          5432
        ]
      },
      {
        "to": "app=redis",
        "ports": [
          6379
        ]
      }
    ],
    "appliedPods": 3,
    "deniedConnections24h": 456,
    "status": "enforced"
  },
  {
    "id": "NP-002",
    "name": "fraud-detection-ingress",
    "namespace": "banking",
    "podSelector": "app=fraud-detection-rs",
    "ingressRules": [
      {
        "from": "app=payments-hub",
        "ports": [
          8115
        ]
      }
    ],
    "egressRules": [
      {
        "to": "app=redis",
        "ports": [
          6379
        ]
      },
      {
        "to": "app=kafka",
        "ports": [
          9092
        ]
      }
    ],
    "appliedPods": 2,
    "deniedConnections24h": 234,
    "status": "enforced"
  },
  {
    "id": "NP-003",
    "name": "database-isolation",
    "namespace": "data",
    "podSelector": "app=postgres",
    "ingressRules": [
      {
        "from": "namespace=banking",
        "ports": [
          5432
        ]
      }
    ],
    "egressRules": [],
    "appliedPods": 3,
    "deniedConnections24h": 1234,
    "status": "enforced"
  },
  {
    "id": "NP-004",
    "name": "deny-all-default",
    "namespace": "banking",
    "podSelector": "*",
    "ingressRules": [],
    "egressRules": [
      {
        "to": "app=dns",
        "ports": [
          53
        ]
      }
    ],
    "appliedPods": 266,
    "deniedConnections24h": 89000,
    "status": "enforced"
  }
]""")

MIDDLEWARE = json.loads("""{
  "kafka": {
    "broker": "kafka:9092",
    "topics": [
      "security.network.policy.manager.py"
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
    "appId": "network-policy-manager-py"
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
            self._json(200, {"service": "network-policy-manager-py", "status": "healthy", "version": "1.0.0", "description": "Kubernetes NetworkPolicy generator, service dependency graph, micro-segmentation, zero-trust network", "middleware": MIDDLEWARE})
        elif self.path == "/v1/network-policy/list":
            self._json(200, {"total": len(ITEMS), "network_policies": ITEMS})
        elif self.path == "/v1/network-policy/stats":
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
    port = int(os.environ.get("PORT", "8514"))
    print(f"Network Policy Manager listening on :{port}")
    HTTPServer(("0.0.0.0", port), Handler).serve_forever()
