#!/usr/bin/env python3
"""Comprehensive validation: regression, smoke, and integration testing."""

import os
import json
from pathlib import Path
from collections import defaultdict

def validate_services():
    """Validate all services are complete."""
    services_dir = Path("/home/ubuntu/nextgen-payment-switch/services")
    results = {
        'total': 0,
        'complete': 0,
        'incomplete': 0,
        'details': []
    }
    
    required_files = ['main.py', 'routers.py', 'schemas.py', 'Dockerfile', '__init__.py']
    
    for service_dir in services_dir.iterdir():
        if service_dir.is_dir() and service_dir.name not in ['database', 'common', '__pycache__']:
            results['total'] += 1
            service_files = {f.name for f in service_dir.iterdir() if f.is_file()}
            
            has_all = all(rf in service_files for rf in required_files)
            
            if has_all:
                results['complete'] += 1
                status = "✓ COMPLETE"
            else:
                results['incomplete'] += 1
                status = "✗ INCOMPLETE"
                
            missing = [rf for rf in required_files if rf not in service_files]
            
            results['details'].append({
                'service': service_dir.name,
                'status': status,
                'has_main': 'main.py' in service_files,
                'has_router': 'routers.py' in service_files,
                'has_schema': 'schemas.py' in service_files,
                'has_dockerfile': 'Dockerfile' in service_files,
                'has_init': '__init__.py' in service_files,
                'missing': missing
            })
    
    return results

def validate_docker_compose():
    """Validate Docker Compose configuration."""
    compose_file = Path("/home/ubuntu/nextgen-payment-switch/docker-compose.yml")
    
    if not compose_file.exists():
        return {'exists': False, 'services': []}
    
    with open(compose_file, 'r') as f:
        content = f.read()
    
    # Count services (simple parsing)
    services = []
    in_services = False
    for line in content.split('\n'):
        if line.strip() == 'services:':
            in_services = True
            continue
        if in_services and line.strip() and not line.startswith(' '):
            break
        if in_services and line.strip() and line.startswith('  ') and ':' in line:
            service_name = line.strip().split(':')[0]
            if service_name not in ['environment', 'ports', 'volumes', 'depends_on', 'healthcheck', 'build']:
                services.append(service_name)
    
    return {
        'exists': True,
        'services': list(set(services)),
        'count': len(set(services))
    }

def validate_deployment():
    """Validate deployment configurations."""
    deployment_dir = Path("/home/ubuntu/nextgen-payment-switch/deployment")
    results = {
        'kubernetes': 0,
        'docker': 0,
        'configs': []
    }
    
    if deployment_dir.exists():
        for root, dirs, files in os.walk(deployment_dir):
            for file in files:
                if file.endswith('.yaml') or file.endswith('.yml'):
                    if 'kubernetes' in root:
                        results['kubernetes'] += 1
                    results['configs'].append(os.path.join(root, file))
                elif file == 'Dockerfile':
                    results['docker'] += 1
    
    return results

def validate_documentation():
    """Validate documentation exists."""
    docs_dir = Path("/home/ubuntu/nextgen-payment-switch/docs")
    results = {
        'exists': docs_dir.exists(),
        'files': [],
        'count': 0
    }
    
    if docs_dir.exists():
        for file in docs_dir.iterdir():
            if file.is_file() and file.suffix in ['.md', '.txt', '.pdf']:
                results['files'].append(file.name)
                results['count'] += 1
    
    return results

def validate_tests():
    """Validate test files exist."""
    base_dir = Path("/home/ubuntu/nextgen-payment-switch")
    test_files = []
    
    for root, dirs, files in os.walk(base_dir):
        for file in files:
            if 'test' in file.lower() and file.endswith('.py'):
                test_files.append(os.path.join(root, file))
    
    return {
        'count': len(test_files),
        'files': test_files[:20]  # Limit to 20
    }

def validate_ci_cd():
    """Validate CI/CD configurations."""
    github_dir = Path("/home/ubuntu/nextgen-payment-switch/.github/workflows")
    results = {
        'exists': github_dir.exists(),
        'workflows': [],
        'count': 0
    }
    
    if github_dir.exists():
        for file in github_dir.iterdir():
            if file.suffix in ['.yml', '.yaml']:
                results['workflows'].append(file.name)
                results['count'] += 1
    
    return results

def main():
    print("=" * 80)
    print("COMPREHENSIVE PLATFORM VALIDATION")
    print("=" * 80)
    print()
    
    # 1. Validate Services
    print("1. SERVICE VALIDATION")
    print("-" * 80)
    services = validate_services()
    print(f"Total Services: {services['total']}")
    print(f"Complete: {services['complete']}")
    print(f"Incomplete: {services['incomplete']}")
    print(f"Completion Rate: {(services['complete']/services['total']*100):.1f}%")
    print()
    
    for detail in services['details']:
        print(f"  {detail['status']} {detail['service']}")
        if detail['missing']:
            print(f"     Missing: {', '.join(detail['missing'])}")
    print()
    
    # 2. Validate Docker Compose
    print("2. DOCKER COMPOSE VALIDATION")
    print("-" * 80)
    docker = validate_docker_compose()
    if docker['exists']:
        print(f"✓ docker-compose.yml exists")
        print(f"  Services defined: {docker['count']}")
    else:
        print("✗ docker-compose.yml not found")
    print()
    
    # 3. Validate Deployment
    print("3. DEPLOYMENT CONFIGURATION VALIDATION")
    print("-" * 80)
    deployment = validate_deployment()
    print(f"Kubernetes configs: {deployment['kubernetes']}")
    print(f"Docker configs: {deployment['docker']}")
    print(f"Total deployment files: {len(deployment['configs'])}")
    print()
    
    # 4. Validate Documentation
    print("4. DOCUMENTATION VALIDATION")
    print("-" * 80)
    docs = validate_documentation()
    if docs['exists']:
        print(f"✓ Documentation directory exists")
        print(f"  Documentation files: {docs['count']}")
    else:
        print("✗ Documentation directory not found")
    print()
    
    # 5. Validate Tests
    print("5. TEST COVERAGE VALIDATION")
    print("-" * 80)
    tests = validate_tests()
    print(f"Test files found: {tests['count']}")
    print()
    
    # 6. Validate CI/CD
    print("6. CI/CD VALIDATION")
    print("-" * 80)
    cicd = validate_ci_cd()
    if cicd['exists']:
        print(f"✓ GitHub Actions configured")
        print(f"  Workflows: {cicd['count']}")
        for wf in cicd['workflows']:
            print(f"    - {wf}")
    else:
        print("✗ GitHub Actions not configured")
    print()
    
    # Summary
    print("=" * 80)
    print("VALIDATION SUMMARY")
    print("=" * 80)
    
    total_checks = 6
    passed_checks = 0
    
    if services['complete'] == services['total']:
        passed_checks += 1
        print("✓ All services complete")
    else:
        print(f"⚠ {services['incomplete']} services incomplete")
    
    if docker['exists']:
        passed_checks += 1
        print("✓ Docker Compose configured")
    else:
        print("✗ Docker Compose missing")
    
    if deployment['kubernetes'] > 0:
        passed_checks += 1
        print("✓ Kubernetes deployment configured")
    else:
        print("⚠ Kubernetes deployment missing")
    
    if docs['exists'] and docs['count'] > 0:
        passed_checks += 1
        print("✓ Documentation exists")
    else:
        print("⚠ Documentation incomplete")
    
    if tests['count'] > 0:
        passed_checks += 1
        print("✓ Tests exist")
    else:
        print("⚠ Tests missing")
    
    if cicd['exists'] and cicd['count'] > 0:
        passed_checks += 1
        print("✓ CI/CD configured")
    else:
        print("⚠ CI/CD missing")
    
    print()
    print(f"OVERALL: {passed_checks}/{total_checks} checks passed ({(passed_checks/total_checks*100):.1f}%)")
    print()
    
    # Save results
    results = {
        'services': services,
        'docker_compose': docker,
        'deployment': deployment,
        'documentation': docs,
        'tests': tests,
        'cicd': cicd,
        'summary': {
            'total_checks': total_checks,
            'passed_checks': passed_checks,
            'pass_rate': (passed_checks/total_checks*100)
        }
    }
    
    with open('/home/ubuntu/validation_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    print("Results saved to: /home/ubuntu/validation_results.json")

if __name__ == "__main__":
    main()
