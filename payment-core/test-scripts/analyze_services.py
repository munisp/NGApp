#!/usr/bin/env python3
"""
Analyze all services to identify missing routers, schemas, and TODOs
"""

import os
import re
from pathlib import Path
from collections import defaultdict

def analyze_service_file(filepath):
    """Analyze a single service file"""
    with open(filepath, 'r') as f:
        content = f.read()
    
    analysis = {
        'has_fastapi': 'FastAPI' in content or 'from fastapi' in content,
        'has_router': 'APIRouter' in content or '@app.' in content or '@router.' in content,
        'has_pydantic': 'BaseModel' in content or 'from pydantic' in content,
        'has_database': 'database' in content.lower() or 'db' in content.lower(),
        'endpoints': len(re.findall(r'@(app|router)\.(get|post|put|delete|patch)', content)),
        'todos': re.findall(r'#\s*(TODO|FIXME|XXX):?\s*(.+)', content, re.IGNORECASE),
        'comments_placeholder': re.findall(r'#\s*(In production|placeholder|mock|simulate|dummy)', content, re.IGNORECASE),
        'line_count': len(content.split('\n'))
    }
    
    return analysis

def main():
    services_dir = Path('/home/ubuntu/nextgen-payment-switch/services')
    
    results = defaultdict(dict)
    
    # Analyze each service
    for service_dir in services_dir.iterdir():
        if not service_dir.is_dir() or service_dir.name == 'common':
            continue
            
        service_name = service_dir.name
        main_file = service_dir / 'main.py'
        
        if main_file.exists():
            results[service_name]['main'] = analyze_service_file(main_file)
            results[service_name]['path'] = str(main_file)
        
        # Check for router files
        router_files = list(service_dir.glob('*router*.py')) + list(service_dir.glob('*routes*.py'))
        results[service_name]['has_router_file'] = len(router_files) > 0
        results[service_name]['router_files'] = [str(f) for f in router_files]
        
        # Check for schema files
        schema_files = list(service_dir.glob('*schema*.py')) + list(service_dir.glob('*model*.py'))
        results[service_name]['has_schema_file'] = len(schema_files) > 0
        results[service_name]['schema_files'] = [str(f) for f in schema_files]
    
    # Print report
    print("=" * 80)
    print("SERVICE ANALYSIS REPORT")
    print("=" * 80)
    
    for service_name, data in sorted(results.items()):
        print(f"\n{service_name.upper()}")
        print("-" * 80)
        
        if 'main' in data:
            main_analysis = data['main']
            print(f"  Main file: {data['path']}")
            print(f"  Lines: {main_analysis['line_count']}")
            print(f"  Has FastAPI: {main_analysis['has_fastapi']}")
            print(f"  Has Router: {main_analysis['has_router']}")
            print(f"  Endpoints: {main_analysis['endpoints']}")
            print(f"  Has Pydantic Models: {main_analysis['has_pydantic']}")
            print(f"  Has Database: {main_analysis['has_database']}")
            print(f"  TODOs: {len(main_analysis['todos'])}")
            if main_analysis['todos']:
                for todo in main_analysis['todos'][:3]:  # Show first 3
                    print(f"    - {todo[0]}: {todo[1][:60]}")
            print(f"  Placeholder Comments: {len(main_analysis['comments_placeholder'])}")
            if main_analysis['comments_placeholder']:
                for comment in main_analysis['comments_placeholder'][:3]:
                    print(f"    - {comment}")
        
        print(f"  Separate Router File: {data.get('has_router_file', False)}")
        if data.get('router_files'):
            for rf in data['router_files']:
                print(f"    - {rf}")
        
        print(f"  Separate Schema File: {data.get('has_schema_file', False)}")
        if data.get('schema_files'):
            for sf in data['schema_files']:
                print(f"    - {sf}")
    
    # Summary
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    
    services_with_fastapi = sum(1 for d in results.values() if d.get('main', {}).get('has_fastapi', False))
    services_with_routers = sum(1 for d in results.values() if d.get('main', {}).get('has_router', False))
    services_with_separate_routers = sum(1 for d in results.values() if d.get('has_router_file', False))
    services_with_schemas = sum(1 for d in results.values() if d.get('has_schema_file', False))
    total_todos = sum(len(d.get('main', {}).get('todos', [])) for d in results.values())
    total_placeholders = sum(len(d.get('main', {}).get('comments_placeholder', [])) for d in results.values())
    
    print(f"Total Services: {len(results)}")
    print(f"Services with FastAPI: {services_with_fastapi}")
    print(f"Services with Routers: {services_with_routers}")
    print(f"Services with Separate Router Files: {services_with_separate_routers}")
    print(f"Services with Separate Schema Files: {services_with_schemas}")
    print(f"Total TODOs: {total_todos}")
    print(f"Total Placeholder Comments: {total_placeholders}")
    
    # Services needing routers
    print("\nServices needing separate router files:")
    for service_name, data in sorted(results.items()):
        if data.get('main', {}).get('has_fastapi', False) and not data.get('has_router_file', False):
            print(f"  - {service_name}")
    
    # Services needing schemas
    print("\nServices needing separate schema files:")
    for service_name, data in sorted(results.items()):
        if data.get('main', {}).get('has_pydantic', False) and not data.get('has_schema_file', False):
            print(f"  - {service_name}")

if __name__ == '__main__':
    main()
