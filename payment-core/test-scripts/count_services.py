import yaml

with open('/home/ubuntu/nextgen-payment-switch/docker-compose.yml', 'r') as f:
    compose = yaml.safe_load(f)

services = compose.get('services', {})
print(f"Total services defined: {len(services)}")
print("\nServices:")
for i, service in enumerate(services.keys(), 1):
    print(f"  {i}. {service}")
