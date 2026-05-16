################################################################################
# Unified Insurance Platform — Terraform Root Module
# Provisions: OpenStack VMs, Kubernetes cluster, all infrastructure services
# Environments: staging | production
################################################################################

terraform {
  required_version = ">= 1.8.0"

  required_providers {
    openstack = {
      source  = "terraform-provider-openstack/openstack"
      version = "~> 1.54"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.31"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.14"
    }
    vault = {
      source  = "hashicorp/vault"
      version = "~> 4.3"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }

  backend "s3" {
    bucket         = "insurance-platform-terraform-state"
    key            = "insurance-platform/terraform.tfstate"
    region         = "eu-west-1"
    encrypt        = true
    dynamodb_table = "insurance-platform-terraform-locks"
  }
}

# ============================================================
# PROVIDERS
# ============================================================
provider "openstack" {
  auth_url    = var.openstack_auth_url
  tenant_name = var.openstack_tenant_name
  user_name   = var.openstack_user_name
  password    = var.openstack_password
  region      = var.openstack_region
  insecure    = false
}

provider "kubernetes" {
  host                   = module.kubernetes.cluster_endpoint
  cluster_ca_certificate = base64decode(module.kubernetes.cluster_ca_certificate)
  token                  = module.kubernetes.cluster_token
}

provider "helm" {
  kubernetes {
    host                   = module.kubernetes.cluster_endpoint
    cluster_ca_certificate = base64decode(module.kubernetes.cluster_ca_certificate)
    token                  = module.kubernetes.cluster_token
  }
}

provider "vault" {
  address = "https://vault.${var.domain}:8200"
  token   = var.vault_root_token
}

# ============================================================
# MODULES
# ============================================================
module "openstack_network" {
  source = "./modules/openstack"

  environment         = var.environment
  network_cidr        = var.network_cidr
  dns_nameservers     = var.dns_nameservers
  external_network_id = var.external_network_id
  availability_zones  = var.availability_zones
}

module "kubernetes" {
  source = "./modules/kubernetes"

  environment        = var.environment
  cluster_name       = "insurance-${var.environment}"
  network_id         = module.openstack_network.network_id
  subnet_id          = module.openstack_network.subnet_id
  master_count       = var.k8s_master_count
  worker_count       = var.k8s_worker_count
  master_flavor      = var.k8s_master_flavor
  worker_flavor      = var.k8s_worker_flavor
  image_name         = var.k8s_image_name
  keypair_name       = var.keypair_name
  availability_zones = var.availability_zones
  pod_network_cidr   = var.pod_network_cidr
  service_cidr       = var.service_cidr
  dns_domain         = var.domain
}

module "postgres" {
  source = "./modules/postgres"

  environment     = var.environment
  namespace       = "postgres"
  storage_class   = "fast-ssd"
  storage_size    = var.postgres_storage_size
  replica_count   = var.environment == "production" ? 3 : 1
  admin_password  = random_password.postgres_admin.result

  depends_on = [module.kubernetes]
}

module "redis" {
  source = "./modules/redis"

  environment   = var.environment
  namespace     = "redis"
  storage_class = "fast-ssd"
  storage_size  = var.redis_storage_size
  replica_count = var.environment == "production" ? 3 : 1
  password      = random_password.redis.result

  depends_on = [module.kubernetes]
}

module "kafka" {
  source = "./modules/kafka"

  environment    = var.environment
  namespace      = "kafka"
  storage_class  = "fast-ssd"
  storage_size   = var.kafka_storage_size
  broker_count   = var.environment == "production" ? 3 : 1
  sasl_password  = random_password.kafka_sasl.result

  depends_on = [module.kubernetes]
}

module "vault" {
  source = "./modules/vault"

  environment      = var.environment
  namespace        = "vault"
  storage_class    = "fast-ssd"
  storage_size     = "10Gi"
  replica_count    = var.environment == "production" ? 3 : 1
  kms_key_id       = var.vault_kms_key_id
  kms_region       = var.openstack_region

  depends_on = [module.kubernetes]
}

module "keycloak" {
  source = "./modules/keycloak"

  environment     = var.environment
  namespace       = "keycloak"
  admin_password  = random_password.keycloak_admin.result
  db_password     = random_password.keycloak_db.result
  postgres_host   = module.postgres.service_host

  depends_on = [module.postgres]
}

module "observability" {
  source = "./modules/observability"

  environment       = var.environment
  namespace         = "observability"
  storage_class     = "fast-ssd"
  prometheus_size   = var.prometheus_storage_size
  grafana_password  = random_password.grafana_admin.result
  loki_size         = var.loki_storage_size
  domain            = var.domain

  depends_on = [module.kubernetes]
}

module "wazuh" {
  source = "./modules/wazuh"

  environment      = var.environment
  namespace        = "wazuh"
  storage_class    = "fast-ssd"
  storage_size     = var.wazuh_storage_size
  cluster_key      = random_password.wazuh_cluster_key.result
  indexer_password = random_password.wazuh_indexer.result

  depends_on = [module.kubernetes]
}

module "unleash" {
  source = "./modules/unleash"

  environment    = var.environment
  namespace      = "unleash"
  db_password    = random_password.unleash_db.result
  postgres_host  = module.postgres.service_host
  api_token      = random_password.unleash_api_token.result

  depends_on = [module.postgres]
}

# ============================================================
# RANDOM PASSWORDS
# ============================================================
resource "random_password" "postgres_admin" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "random_password" "redis" {
  length  = 32
  special = false
}

resource "random_password" "kafka_sasl" {
  length  = 32
  special = false
}

resource "random_password" "keycloak_admin" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "random_password" "keycloak_db" {
  length  = 32
  special = false
}

resource "random_password" "grafana_admin" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "random_password" "wazuh_cluster_key" {
  length  = 32
  special = false
}

resource "random_password" "wazuh_indexer" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "random_password" "unleash_db" {
  length  = 32
  special = false
}

resource "random_password" "unleash_api_token" {
  length  = 64
  special = false
}

# ============================================================
# VAULT SECRET STORAGE
# ============================================================
resource "vault_kv_secret_v2" "infrastructure_secrets" {
  mount = "insurance"
  name  = "infra/generated"

  data_json = jsonencode({
    postgres_admin_password  = random_password.postgres_admin.result
    redis_password           = random_password.redis.result
    kafka_sasl_password      = random_password.kafka_sasl.result
    keycloak_admin_password  = random_password.keycloak_admin.result
    keycloak_db_password     = random_password.keycloak_db.result
    grafana_admin_password   = random_password.grafana_admin.result
    wazuh_cluster_key        = random_password.wazuh_cluster_key.result
    wazuh_indexer_password   = random_password.wazuh_indexer.result
    unleash_db_password      = random_password.unleash_db.result
    unleash_api_token        = random_password.unleash_api_token.result
  })

  depends_on = [module.vault]
}

# ============================================================
# OUTPUTS
# ============================================================
output "kubernetes_endpoint" {
  value     = module.kubernetes.cluster_endpoint
  sensitive = true
}

output "vault_address" {
  value = "https://vault.${var.domain}:8200"
}

output "keycloak_url" {
  value = "https://auth.${var.domain}"
}

output "grafana_url" {
  value = "https://monitoring.${var.domain}"
}

output "api_gateway_url" {
  value = "https://api.${var.domain}"
}

output "portal_url" {
  value = "https://portal.${var.domain}"
}
