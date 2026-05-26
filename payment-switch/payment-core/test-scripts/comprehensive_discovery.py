#!/usr/bin/env python3
"""Comprehensive discovery of all implemented features and components."""

import os
import json
import subprocess
from pathlib import Path
from collections import defaultdict

def run_command(cmd):
    """Run shell command and return output."""
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30)
        return result.stdout.strip()
    except:
        return ""

def discover_projects():
    """Discover all project directories."""
    projects = {}
    
    # Main project
    main_project = "/home/ubuntu/nextgen-payment-switch"
    if os.path.exists(main_project):
        projects['main'] = {
            'path': main_project,
            'type': 'main_platform',
            'subdirs': []
        }
        
        # Get subdirectories
        for item in os.listdir(main_project):
            item_path = os.path.join(main_project, item)
            if os.path.isdir(item_path) and not item.startswith('.'):
                projects['main']['subdirs'].append(item)
    
    # Search for archives
    archives = []
    for file in Path('/home/ubuntu').glob('*.zip'):
        archives.append({
            'name': file.name,
            'path': str(file),
            'size': file.stat().st_size
        })
    
    projects['archives'] = sorted(archives, key=lambda x: x['size'], reverse=True)
    
    return projects

def analyze_services():
    """Analyze all services in the platform."""
    services_dir = "/home/ubuntu/nextgen-payment-switch/services"
    services = {}
    
    if os.path.exists(services_dir):
        for service in os.listdir(services_dir):
            service_path = os.path.join(services_dir, service)
            if os.path.isdir(service_path):
                services[service] = {
                    'path': service_path,
                    'has_main': os.path.exists(os.path.join(service_path, 'main.py')),
                    'has_router': os.path.exists(os.path.join(service_path, 'routers.py')),
                    'has_schema': os.path.exists(os.path.join(service_path, 'schemas.py')),
                    'has_dockerfile': os.path.exists(os.path.join(service_path, 'Dockerfile')),
                    'files': []
                }
                
                # List Python files
                for file in Path(service_path).glob('*.py'):
                    services[service]['files'].append(file.name)
    
    return services

def discover_features():
    """Discover all implemented features."""
    features = defaultdict(list)
    
    base_dir = "/home/ubuntu/nextgen-payment-switch"
    
    # Check for specific features
    feature_indicators = {
        'mobile': ['mobile', 'ios', 'android', 'react-native', 'flutter'],
        'pwa': ['pwa', 'progressive-web-app', 'service-worker', 'manifest.json'],
        'hybrid': ['hybrid', 'capacitor', 'cordova', 'ionic'],
        'api_gateway': ['apisix', 'nginx', 'kong', 'api-gateway'],
        'monitoring': ['prometheus', 'grafana', 'wazuh', 'opencti'],
        'data_integration': ['lakehouse', 'delta-lake', 'flink', 'kafka'],
        'fraud_detection': ['fraud', 'gnn', 'graph-attention'],
        'pos': ['pos', 'point-of-sale', 'terminal'],
        'security': ['wazuh', 'opencti', 'security', 'threat'],
        'workflow': ['temporal', 'workflow', 'orchestration'],
        'ledger': ['tigerbeetle', 'ledger', 'accounting']
    }
    
    # Search in directory names
    if os.path.exists(base_dir):
        for root, dirs, files in os.walk(base_dir):
            for dir_name in dirs:
                for feature, keywords in feature_indicators.items():
                    if any(keyword in dir_name.lower() for keyword in keywords):
                        features[feature].append(os.path.join(root, dir_name))
            
            # Search in file names
            for file_name in files:
                for feature, keywords in feature_indicators.items():
                    if any(keyword in file_name.lower() for keyword in keywords):
                        features[feature].append(os.path.join(root, file_name))
    
    # Remove duplicates
    for feature in features:
        features[feature] = list(set(features[feature]))[:10]  # Limit to 10 per feature
    
    return dict(features)

def check_docker_compose():
    """Check Docker Compose configuration."""
    compose_file = "/home/ubuntu/nextgen-payment-switch/docker-compose.yml"
    if os.path.exists(compose_file):
        with open(compose_file, 'r') as f:
            content = f.read()
            services = []
            for line in content.split('\n'):
                if line.strip() and not line.strip().startswith('#') and ':' in line:
                    if line.strip().endswith(':') and not line.strip().startswith('-'):
                        service_name = line.strip().rstrip(':')
                        if service_name not in ['services', 'volumes', 'networks', 'version']:
                            services.append(service_name)
            return services[:20]  # Limit to first 20
    return []

def main():
    print("=" * 80)
    print("COMPREHENSIVE PLATFORM DISCOVERY")
    print("=" * 80)
    print()
    
    # Discover projects
    print("1. DISCOVERING PROJECTS...")
    projects = discover_projects()
    print(f"   Main project: {projects.get('main', {}).get('path', 'Not found')}")
    print(f"   Subdirectories: {len(projects.get('main', {}).get('subdirs', []))}")
    print(f"   Archives found: {len(projects.get('archives', []))}")
    print()
    
    # Analyze services
    print("2. ANALYZING SERVICES...")
    services = analyze_services()
    print(f"   Total services: {len(services)}")
    for service, info in services.items():
        status = "✓" if info['has_main'] and info['has_router'] else "✗"
        print(f"   {status} {service}: main={info['has_main']}, router={info['has_router']}, schema={info['has_schema']}")
    print()
    
    # Discover features
    print("3. DISCOVERING FEATURES...")
    features = discover_features()
    for feature, paths in features.items():
        print(f"   {feature.upper()}: {len(paths)} components found")
    print()
    
    # Check Docker Compose
    print("4. DOCKER COMPOSE SERVICES...")
    docker_services = check_docker_compose()
    print(f"   Services in docker-compose.yml: {len(docker_services)}")
    for svc in docker_services:
        print(f"   - {svc}")
    print()
    
    # Save results
    results = {
        'projects': projects,
        'services': services,
        'features': features,
        'docker_services': docker_services
    }
    
    output_file = "/home/ubuntu/discovery_results.json"
    with open(output_file, 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"Results saved to: {output_file}")
    print()
    
    # Summary
    print("=" * 80)
    print("DISCOVERY SUMMARY")
    print("=" * 80)
    print(f"Total Services: {len(services)}")
    print(f"Total Features: {len(features)}")
    print(f"Total Archives: {len(projects.get('archives', []))}")
    print(f"Docker Services: {len(docker_services)}")
    print()

if __name__ == "__main__":
    main()
