import yaml

with open('/home/ubuntu/nextgen-payment-switch/docker-compose.yml', 'r') as f:
    compose = yaml.safe_load(f)

services = compose.get('services', {})
print(f"Total Services: {len(services)}")
print("\nService List:")
for i, service_name in enumerate(services.keys(), 1):
    ports = services[service_name].get('ports', [])
    port_str = ports[0] if ports else "N/A"
    print(f"{i:2d}. {service_name:35s} - Port: {port_str}")
