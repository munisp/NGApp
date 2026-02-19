#!/bin/bash

# Deploy Fresh Market Template

echo "Deploying Fresh Market..."

# Copy template to storefront
cp -r /home/ubuntu/agent-banking-platform/frontend/storefront-templates/grocery/* \
      /home/ubuntu/agent-banking-platform/frontend/agent-storefront/

# Update configuration
cd /home/ubuntu/agent-banking-platform/frontend/agent-storefront
cat config.json

echo "Template deployed successfully!"
echo "Start your storefront with: ./start_storefront.sh"
