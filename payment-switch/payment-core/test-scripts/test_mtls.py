#!/usr/bin/env python3
"""
mTLS Validation Test Script
Tests mutual TLS authentication between services in the payment switch platform
"""

import subprocess
import json
import sys
from datetime import datetime
from typing import Dict, List, Any

class MTLSValidator:
    def __init__(self, namespace: str = "payment-switch"):
        self.namespace = namespace
        self.results = []
        
    def run_test(self, test_name: str, test_func):
        """Run a single test and record results"""
        print(f"\n[TEST] {test_name}")
        try:
            result = test_func()
            self.results.append({
                "test": test_name,
                "status": "PASS" if result else "FAIL",
                "timestamp": datetime.now().isoformat()
            })
            print(f"[{'PASS' if result else 'FAIL'}] {test_name}")
            return result
        except Exception as e:
            self.results.append({
                "test": test_name,
                "status": "ERROR",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            })
            print(f"[ERROR] {test_name}: {e}")
            return False
    
    def test_istio_installed(self) -> bool:
        """Test 1: Verify Istio is installed"""
        result = subprocess.run(
            ["kubectl", "get", "namespace", "istio-system"],
            capture_output=True,
            text=True
        )
        return result.returncode == 0
    
    def test_peer_authentication_exists(self) -> bool:
        """Test 2: Verify PeerAuthentication policy exists"""
        result = subprocess.run(
            ["kubectl", "get", "peerauthentication", "-n", self.namespace],
            capture_output=True,
            text=True
        )
        return result.returncode == 0 and "default" in result.stdout
    
    def test_mtls_mode_strict(self) -> bool:
        """Test 3: Verify mTLS mode is STRICT"""
        result = subprocess.run(
            ["kubectl", "get", "peerauthentication", "default", "-n", self.namespace, "-o", "json"],
            capture_output=True,
            text=True
        )
        if result.returncode != 0:
            return False
        
        data = json.loads(result.stdout)
        mode = data.get("spec", {}).get("mtls", {}).get("mode", "")
        return mode == "STRICT"
    
    def test_sidecar_injection(self) -> bool:
        """Test 4: Verify Istio sidecar injection is enabled"""
        result = subprocess.run(
            ["kubectl", "get", "namespace", self.namespace, "-o", "json"],
            capture_output=True,
            text=True
        )
        if result.returncode != 0:
            return False
        
        data = json.loads(result.stdout)
        labels = data.get("metadata", {}).get("labels", {})
        return labels.get("istio-injection") == "enabled"
    
    def test_service_mesh_connectivity(self) -> bool:
        """Test 5: Verify services can communicate via mTLS"""
        # Get a pod from payment-gateway
        result = subprocess.run(
            ["kubectl", "get", "pods", "-n", self.namespace, "-l", "app=payment-gateway", "-o", "json"],
            capture_output=True,
            text=True
        )
        if result.returncode != 0:
            return False
        
        pods = json.loads(result.stdout).get("items", [])
        if not pods:
            print("  No payment-gateway pods found")
            return False
        
        pod_name = pods[0]["metadata"]["name"]
        
        # Test connectivity to fraud-detection-service
        result = subprocess.run(
            ["kubectl", "exec", "-n", self.namespace, pod_name, "-c", "payment-gateway", 
             "--", "curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", 
             "http://fraud-detection-service:8002/health"],
            capture_output=True,
            text=True
        )
        
        return result.stdout.strip() == "200"
    
    def test_certificate_rotation(self) -> bool:
        """Test 6: Verify certificate rotation is configured"""
        result = subprocess.run(
            ["kubectl", "get", "configmap", "istio", "-n", "istio-system", "-o", "json"],
            capture_output=True,
            text=True
        )
        if result.returncode != 0:
            return False
        
        data = json.loads(result.stdout)
        mesh_config = data.get("data", {}).get("mesh", "")
        return "certificateRotation" in mesh_config or "trustDomain" in mesh_config
    
    def generate_report(self, output_file: str = "mtls_test_results.json"):
        """Generate test results report"""
        report = {
            "test_suite": "mTLS Validation",
            "timestamp": datetime.now().isoformat(),
            "namespace": self.namespace,
            "total_tests": len(self.results),
            "passed": sum(1 for r in self.results if r["status"] == "PASS"),
            "failed": sum(1 for r in self.results if r["status"] == "FAIL"),
            "errors": sum(1 for r in self.results if r["status"] == "ERROR"),
            "results": self.results
        }
        
        with open(output_file, 'w') as f:
            json.dump(report, f, indent=2)
        
        print(f"\n{'='*60}")
        print(f"mTLS Validation Test Results")
        print(f"{'='*60}")
        print(f"Total Tests: {report['total_tests']}")
        print(f"Passed: {report['passed']}")
        print(f"Failed: {report['failed']}")
        print(f"Errors: {report['errors']}")
        print(f"Success Rate: {(report['passed']/report['total_tests']*100):.1f}%")
        print(f"\nResults saved to: {output_file}")
        
        return report['failed'] == 0 and report['errors'] == 0

def main():
    validator = MTLSValidator()
    
    # Run all tests
    validator.run_test("Istio Installation", validator.test_istio_installed)
    validator.run_test("PeerAuthentication Policy Exists", validator.test_peer_authentication_exists)
    validator.run_test("mTLS Mode is STRICT", validator.test_mtls_mode_strict)
    validator.run_test("Sidecar Injection Enabled", validator.test_sidecar_injection)
    validator.run_test("Service Mesh Connectivity", validator.test_service_mesh_connectivity)
    validator.run_test("Certificate Rotation Configured", validator.test_certificate_rotation)
    
    # Generate report
    success = validator.generate_report()
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
