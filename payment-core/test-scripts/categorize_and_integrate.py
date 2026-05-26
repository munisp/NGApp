#!/usr/bin/env python3
"""Categorize all components and create integration plan."""

import json
import os
from pathlib import Path

# Load discovery results
with open('/home/ubuntu/discovery_results.json', 'r') as f:
    discovery = json.load(f)

# Categorize components
categorization = {
    'CRITICAL': {
        'description': 'Core platform components required for basic operation',
        'components': []
    },
    'HIGH_PRIORITY': {
        'description': 'Important features that enhance platform capabilities',
        'components': []
    },
    'MEDIUM_PRIORITY': {
        'description': 'Additional features and optimizations',
        'components': []
    },
    'MISSING': {
        'description': 'Components that need to be implemented',
        'components': []
    }
}

# Categorize services
services = discovery['services']

# CRITICAL: Services with complete implementation
for service, info in services.items():
    if info['has_main'] and info['has_router'] and info['has_schema']:
        categorization['CRITICAL']['components'].append({
            'type': 'service',
            'name': service,
            'path': info['path'],
            'status': 'complete',
            'has_dockerfile': info['has_dockerfile']
        })

# HIGH_PRIORITY: Services with partial implementation
for service, info in services.items():
    if info['has_main'] and not (info['has_router'] and info['has_schema']):
        categorization['HIGH_PRIORITY']['components'].append({
            'type': 'service',
            'name': service,
            'path': info['path'],
            'status': 'partial',
            'missing': []
        })
        if not info['has_router']:
            categorization['HIGH_PRIORITY']['components'][-1]['missing'].append('router')
        if not info['has_schema']:
            categorization['HIGH_PRIORITY']['components'][-1]['missing'].append('schema')

# MISSING: Services without main.py
for service, info in services.items():
    if not info['has_main'] and service not in ['database', 'common']:
        categorization['MISSING']['components'].append({
            'type': 'service',
            'name': service,
            'path': info['path'],
            'status': 'missing',
            'needs': ['main.py', 'routers.py', 'schemas.py', 'Dockerfile']
        })

# Categorize features
features = discovery['features']

for feature, paths in features.items():
    if len(paths) >= 5:
        categorization['CRITICAL']['components'].append({
            'type': 'feature',
            'name': feature,
            'count': len(paths),
            'status': 'implemented'
        })
    elif len(paths) >= 2:
        categorization['HIGH_PRIORITY']['components'].append({
            'type': 'feature',
            'name': feature,
            'count': len(paths),
            'status': 'partial'
        })

# Check for mobile/PWA/hybrid
mobile_features = ['mobile', 'pwa', 'hybrid', 'native_app']
for mf in mobile_features:
    categorization['MISSING']['components'].append({
        'type': 'frontend',
        'name': mf,
        'status': 'not_implemented',
        'recommendation': 'Create separate frontend project'
    })

# Print categorization
print("=" * 80)
print("COMPONENT CATEGORIZATION")
print("=" * 80)
print()

for priority, data in categorization.items():
    print(f"\n{'='*80}")
    print(f"{priority}: {data['description']}")
    print(f"{'='*80}")
    print(f"Total components: {len(data['components'])}")
    print()
    
    for comp in data['components']:
        if comp['type'] == 'service':
            status_icon = "✓" if comp['status'] == 'complete' else "⚠" if comp['status'] == 'partial' else "✗"
            print(f"  {status_icon} Service: {comp['name']}")
            if comp['status'] == 'partial':
                print(f"     Missing: {', '.join(comp.get('missing', []))}")
            elif comp['status'] == 'missing':
                print(f"     Needs: {', '.join(comp.get('needs', []))}")
        elif comp['type'] == 'feature':
            print(f"  ✓ Feature: {comp['name']} ({comp['count']} components)")
        elif comp['type'] == 'frontend':
            print(f"  ✗ Frontend: {comp['name']} - {comp.get('recommendation', '')}")

# Save categorization
with open('/home/ubuntu/categorization_results.json', 'w') as f:
    json.dump(categorization, f, indent=2)

print(f"\n\nResults saved to: /home/ubuntu/categorization_results.json")

# Generate integration plan
print("\n" + "="*80)
print("INTEGRATION PLAN")
print("="*80)

plan = {
    'phase_1': {
        'name': 'Complete Missing Service Implementations',
        'tasks': []
    },
    'phase_2': {
        'name': 'Integrate All Components',
        'tasks': []
    },
    'phase_3': {
        'name': 'Create Frontend Applications',
        'tasks': []
    },
    'phase_4': {
        'name': 'Comprehensive Testing',
        'tasks': []
    },
    'phase_5': {
        'name': 'Generate Unified Archive',
        'tasks': []
    }
}

# Phase 1: Complete services
for comp in categorization['HIGH_PRIORITY']['components'] + categorization['MISSING']['components']:
    if comp['type'] == 'service':
        plan['phase_1']['tasks'].append(f"Complete {comp['name']}: {comp['status']}")

# Phase 2: Integration
plan['phase_2']['tasks'] = [
    "Merge all service implementations",
    "Update docker-compose.yml with all services",
    "Configure service discovery and communication",
    "Set up API gateway routing",
    "Configure monitoring and logging"
]

# Phase 3: Frontend
plan['phase_3']['tasks'] = [
    "Design API contracts for frontend",
    "Create REST API documentation",
    "Set up CORS and authentication",
    "Prepare deployment infrastructure"
]

# Phase 4: Testing
plan['phase_4']['tasks'] = [
    "Unit tests for all services",
    "Integration tests for service communication",
    "End-to-end API tests",
    "Load and performance tests",
    "Security and penetration tests"
]

# Phase 5: Archive
plan['phase_5']['tasks'] = [
    "Consolidate all components",
    "Generate comprehensive documentation",
    "Create deployment guides",
    "Package unified archive",
    "Validate completeness"
]

for phase_key, phase_data in plan.items():
    print(f"\n{phase_data['name']}:")
    for i, task in enumerate(phase_data['tasks'], 1):
        print(f"  {i}. {task}")

# Save plan
with open('/home/ubuntu/integration_plan.json', 'w') as f:
    json.dump(plan, f, indent=2)

print(f"\n\nIntegration plan saved to: /home/ubuntu/integration_plan.json")
