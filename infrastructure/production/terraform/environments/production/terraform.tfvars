################################################################################
# Production Environment — terraform.tfvars
# Sensitive values must be provided via environment variables:
#   TF_VAR_openstack_password, TF_VAR_vault_root_token
################################################################################

environment = "production"
domain      = "insurance-platform.com"

# OpenStack
openstack_auth_url    = "https://openstack.insurance-platform.com:5000/v3"
openstack_tenant_name = "insurance-production"
openstack_user_name   = "insurance-terraform"
openstack_region      = "RegionOne"
external_network_id   = "EXTERNAL_NETWORK_ID"
availability_zones    = ["nova-az1", "nova-az2", "nova-az3"]
network_cidr          = "10.10.0.0/16"
dns_nameservers       = ["10.10.0.2", "8.8.8.8"]
keypair_name          = "insurance-production-key"

# Kubernetes — 3 masters, 9 workers for production HA
k8s_master_count  = 3
k8s_worker_count  = 9
k8s_master_flavor = "m1.xlarge"
k8s_worker_flavor = "m1.2xlarge"
k8s_image_name    = "Ubuntu-22.04-k8s-1.30"
pod_network_cidr  = "10.244.0.0/16"
service_cidr      = "10.96.0.0/12"

# Storage
postgres_storage_size   = "200Gi"
redis_storage_size      = "20Gi"
kafka_storage_size      = "200Gi"
prometheus_storage_size = "500Gi"
loki_storage_size       = "1000Gi"
wazuh_storage_size      = "200Gi"

# Vault
vault_kms_key_id = "alias/insurance-vault-unseal-production"
