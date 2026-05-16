################################################################################
# Kubernetes Module — OpenStack Magnum cluster provisioning
# Creates: cluster, node groups, namespaces, storage classes, RBAC
################################################################################

terraform {
  required_providers {
    openstack = {
      source  = "terraform-provider-openstack/openstack"
      version = "~> 1.54"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.31"
    }
  }
}

# ============================================================
# CLUSTER TEMPLATE
# ============================================================
resource "openstack_containerinfra_clustertemplate_v1" "insurance" {
  name                  = "insurance-k8s-${var.environment}"
  image                 = var.image_name
  coe                   = "kubernetes"
  flavor                = var.worker_flavor
  master_flavor         = var.master_flavor
  dns_nameserver        = "8.8.8.8"
  docker_storage_driver = "overlay2"
  network_driver        = "calico"
  volume_driver         = "cinder"
  server_type           = "vm"
  tls_disabled          = false
  public                = false
  hidden                = false

  labels = {
    kube_tag                       = "v1.30.0"
    container_runtime              = "containerd"
    calico_ipv4pool                = var.pod_network_cidr
    calico_ipv4pool_ipip           = "Always"
    etcd_volume_size               = "10"
    boot_volume_size               = "50"
    boot_volume_type               = "fast-ssd"
    cloud_provider_enabled         = "true"
    metrics_server_enabled         = "true"
    auto_scaling_enabled           = "true"
    auto_healing_enabled           = "true"
    master_lb_floating_ip_enabled  = "true"
    ingress_controller             = "nginx"
    monitoring_enabled             = "false"  # We deploy our own
  }
}

# ============================================================
# CLUSTER
# ============================================================
resource "openstack_containerinfra_cluster_v1" "insurance" {
  name                = "insurance-${var.environment}"
  cluster_template_id = openstack_containerinfra_clustertemplate_v1.insurance.id
  master_count        = var.master_count
  node_count          = var.worker_count
  keypair             = var.keypair_name
  master_flavor       = var.master_flavor
  flavor              = var.worker_flavor

  labels = {
    auto_scaling_enabled = "true"
    min_node_count       = tostring(var.worker_count)
    max_node_count       = tostring(var.worker_count * 2)
  }

  timeouts {
    create = "60m"
    update = "30m"
    delete = "20m"
  }
}

# ============================================================
# NAMESPACES
# ============================================================
locals {
  namespaces = [
    "insurance-platform",
    "vault",
    "keycloak",
    "kafka",
    "redis",
    "postgres",
    "temporal",
    "tigerbeetle",
    "wazuh",
    "opencti",
    "observability",
    "cert-manager",
    "unleash",
    "dapr-system",
    "istio-system",
  ]
}

resource "kubernetes_namespace" "platform" {
  for_each = toset(local.namespaces)

  metadata {
    name = each.value
    labels = {
      "app.kubernetes.io/managed-by" = "terraform"
      "environment"                  = var.environment
    }
  }

  depends_on = [openstack_containerinfra_cluster_v1.insurance]
}

# ============================================================
# STORAGE CLASSES
# ============================================================
resource "kubernetes_storage_class" "fast_ssd" {
  metadata {
    name = "fast-ssd"
    annotations = {
      "storageclass.kubernetes.io/is-default-class" = "true"
    }
  }

  storage_provisioner    = "cinder.csi.openstack.org"
  reclaim_policy         = "Retain"
  volume_binding_mode    = "WaitForFirstConsumer"
  allow_volume_expansion = true

  parameters = {
    type = "fast-ssd"
    fsType = "ext4"
  }

  depends_on = [openstack_containerinfra_cluster_v1.insurance]
}

resource "kubernetes_storage_class" "standard" {
  metadata {
    name = "standard"
  }

  storage_provisioner    = "cinder.csi.openstack.org"
  reclaim_policy         = "Delete"
  volume_binding_mode    = "WaitForFirstConsumer"
  allow_volume_expansion = true

  parameters = {
    type = "standard"
    fsType = "ext4"
  }

  depends_on = [openstack_containerinfra_cluster_v1.insurance]
}

# ============================================================
# CLUSTER RBAC
# ============================================================
resource "kubernetes_cluster_role" "platform_admin" {
  metadata {
    name = "platform-admin"
  }

  rule {
    api_groups = ["*"]
    resources  = ["*"]
    verbs      = ["*"]
  }
}

resource "kubernetes_cluster_role_binding" "platform_admin" {
  metadata {
    name = "platform-admin-binding"
  }

  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "ClusterRole"
    name      = kubernetes_cluster_role.platform_admin.metadata[0].name
  }

  subject {
    kind      = "Group"
    name      = "insurance-platform-admins"
    api_group = "rbac.authorization.k8s.io"
  }
}

# ============================================================
# OUTPUTS
# ============================================================
output "cluster_endpoint" {
  value     = openstack_containerinfra_cluster_v1.insurance.api_address
  sensitive = true
}

output "cluster_ca_certificate" {
  value     = openstack_containerinfra_cluster_v1.insurance.kubeconfig[0].cluster_ca_certificate
  sensitive = true
}

output "cluster_token" {
  value     = openstack_containerinfra_cluster_v1.insurance.kubeconfig[0].token
  sensitive = true
}

output "cluster_id" {
  value = openstack_containerinfra_cluster_v1.insurance.id
}
