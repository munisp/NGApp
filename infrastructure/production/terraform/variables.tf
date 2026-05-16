################################################################################
# Terraform Variables — Unified Insurance Platform
################################################################################

variable "environment" {
  description = "Deployment environment (staging | production)"
  type        = string
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "Environment must be staging or production."
  }
}

variable "domain" {
  description = "Base domain for all services"
  type        = string
  default     = "insurance-platform.com"
}

# ============================================================
# OpenStack
# ============================================================
variable "openstack_auth_url" {
  description = "OpenStack Keystone auth URL"
  type        = string
}

variable "openstack_tenant_name" {
  description = "OpenStack project/tenant name"
  type        = string
}

variable "openstack_user_name" {
  description = "OpenStack user name"
  type        = string
}

variable "openstack_password" {
  description = "OpenStack password"
  type        = string
  sensitive   = true
}

variable "openstack_region" {
  description = "OpenStack region"
  type        = string
  default     = "RegionOne"
}

variable "external_network_id" {
  description = "OpenStack external network ID for floating IPs"
  type        = string
}

variable "availability_zones" {
  description = "List of availability zones"
  type        = list(string)
  default     = ["nova-az1", "nova-az2", "nova-az3"]
}

variable "network_cidr" {
  description = "CIDR for the platform network"
  type        = string
  default     = "10.10.0.0/16"
}

variable "dns_nameservers" {
  description = "DNS nameservers"
  type        = list(string)
  default     = ["8.8.8.8", "8.8.4.4"]
}

variable "keypair_name" {
  description = "OpenStack keypair name for SSH access"
  type        = string
}

# ============================================================
# Kubernetes
# ============================================================
variable "k8s_master_count" {
  description = "Number of Kubernetes master nodes"
  type        = number
  default     = 3
}

variable "k8s_worker_count" {
  description = "Number of Kubernetes worker nodes"
  type        = number
  default     = 6
}

variable "k8s_master_flavor" {
  description = "OpenStack flavor for master nodes"
  type        = string
  default     = "m1.xlarge"
}

variable "k8s_worker_flavor" {
  description = "OpenStack flavor for worker nodes"
  type        = string
  default     = "m1.2xlarge"
}

variable "k8s_image_name" {
  description = "OpenStack image name for Kubernetes nodes"
  type        = string
  default     = "Ubuntu-22.04-k8s-1.30"
}

variable "pod_network_cidr" {
  description = "CIDR for Kubernetes pod network"
  type        = string
  default     = "10.244.0.0/16"
}

variable "service_cidr" {
  description = "CIDR for Kubernetes service network"
  type        = string
  default     = "10.96.0.0/12"
}

# ============================================================
# Storage
# ============================================================
variable "postgres_storage_size" {
  description = "PostgreSQL storage size per replica"
  type        = string
  default     = "100Gi"
}

variable "redis_storage_size" {
  description = "Redis storage size per replica"
  type        = string
  default     = "10Gi"
}

variable "kafka_storage_size" {
  description = "Kafka storage size per broker"
  type        = string
  default     = "100Gi"
}

variable "prometheus_storage_size" {
  description = "Prometheus storage size"
  type        = string
  default     = "200Gi"
}

variable "loki_storage_size" {
  description = "Loki storage size"
  type        = string
  default     = "500Gi"
}

variable "wazuh_storage_size" {
  description = "Wazuh storage size per node"
  type        = string
  default     = "100Gi"
}

# ============================================================
# Vault
# ============================================================
variable "vault_kms_key_id" {
  description = "KMS key ID for Vault auto-unseal"
  type        = string
}

variable "vault_root_token" {
  description = "Vault root token for Terraform provider (use AppRole in production)"
  type        = string
  sensitive   = true
}
