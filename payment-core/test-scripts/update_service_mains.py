#!/usr/bin/env python3
"""
Update all service main.py files to import and register routers
"""

import os

# Update fraud-detection-service main.py
fraud_detection_service_update = '''
# Import router
from .routers import router as fraud_router

# Register router
app.include_router(fraud_router)
'''

# Update payment-gateway main.py
payment_gateway_update = '''
# Import router
from .routers import router as payment_router

# Register router
app.include_router(payment_router)
'''

# Update settlement main.py
settlement_update = '''
# Import router
from .routers import router as settlement_router

# Register router
app.include_router(settlement_router)
'''

# Update offline-payments main.py
offline_payments_update = '''
# Import router
from .routers import router as offline_router

# Register router
app.include_router(offline_router)
'''

# Update fraud-detection main.py
fraud_detection_update = '''
# Import router
from .routers import router as fraud_router

# Register router
app.include_router(fraud_router)
'''

def add_router_registration(filepath, router_import, service_name):
    """Add router registration to main.py"""
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        return False
    
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Check if already registered
    if 'include_router' in content and 'router' in content:
        print(f"Router already registered in {service_name}")
        return False
    
    # Find app initialization
    if 'app = FastAPI(' in content:
        # Add import after other imports
        import_pos = content.rfind('import ')
        if import_pos != -1:
            # Find end of import line
            import_end = content.find('\n', import_pos)
            if import_end != -1:
                # Insert router import
                content = content[:import_end+1] + router_import + content[import_end+1:]
        
        print(f"Updated {service_name} main.py")
        
        with open(filepath, 'w') as f:
            f.write(content)
        return True
    
    return False

# Update each service
services = [
    ("/home/ubuntu/nextgen-payment-switch/services/fraud-detection-service/main.py", 
     "\nfrom routers import router as fraud_router\n", "fraud-detection-service"),
    ("/home/ubuntu/nextgen-payment-switch/services/payment-gateway/main.py",
     "\nfrom routers import router as payment_router\n", "payment-gateway"),
    ("/home/ubuntu/nextgen-payment-switch/services/settlement/main.py",
     "\nfrom routers import router as settlement_router\n", "settlement"),
    ("/home/ubuntu/nextgen-payment-switch/services/offline-payments/main.py",
     "\nfrom routers import router as offline_router\n", "offline-payments"),
    ("/home/ubuntu/nextgen-payment-switch/services/fraud-detection/main.py",
     "\nfrom routers import router as fraud_router\n", "fraud-detection"),
]

updated_count = 0
for filepath, router_import, service_name in services:
    if add_router_registration(filepath, router_import, service_name):
        updated_count += 1

print(f"\nCompleted! Updated {updated_count} service main.py files.")

# Create __init__.py files for proper module imports
init_files = [
    "/home/ubuntu/nextgen-payment-switch/services/fraud-detection-service/__init__.py",
    "/home/ubuntu/nextgen-payment-switch/services/payment-gateway/__init__.py",
    "/home/ubuntu/nextgen-payment-switch/services/settlement/__init__.py",
    "/home/ubuntu/nextgen-payment-switch/services/offline-payments/__init__.py",
    "/home/ubuntu/nextgen-payment-switch/services/fraud-detection/__init__.py",
]

for init_file in init_files:
    if not os.path.exists(init_file):
        with open(init_file, 'w') as f:
            f.write('"""Service package."""\n')
        print(f"Created {init_file}")

print("\nAll __init__.py files created.")
