# Payment Switch Platform - OpenStack Terraform Configuration
# On-Premise Kubernetes Cluster Deployment

terraform {
  required_version = ">= 1.0.0"
  required_providers {
    openstack = {
      source  = "terraform-provider-openstack/openstack"
      version = "~> 1.54.0"
    }
    local = {
      source  = "hashicorp/local"
      version = "~> 2.4.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0.0"
    }
  }
}

# OpenStack Provider Configuration
provider "openstack" {
  # Credentials from environment variables:
  # OS_AUTH_URL, OS_TENANT_NAME, OS_USERNAME, OS_PASSWORD, OS_REGION_NAME
  # Or from clouds.yaml
}

# Variables
variable "cluster_name" {
  description = "Name prefix for all resources"
  type        = string
  default     = "payment-switch"
}

variable "environment" {
  description = "Environment (dev, staging, production)"
  type        = string
  default     = "production"
}

variable "external_network_name" {
  description = "Name of the external network for floating IPs"
  type        = string
  default     = "external"
}

variable "dns_nameservers" {
  description = "DNS nameservers for the subnet"
  type        = list(string)
  default     = ["8.8.8.8", "8.8.4.4"]
}

variable "control_plane_count" {
  description = "Number of control plane nodes"
  type        = number
  default     = 3
}

variable "worker_count" {
  description = "Number of worker nodes"
  type        = number
  default     = 5
}

variable "control_plane_flavor" {
  description = "Flavor for control plane nodes"
  type        = string
  default     = "m1.xlarge"  # 8 vCPU, 16GB RAM
}

variable "worker_flavor" {
  description = "Flavor for worker nodes"
  type        = string
  default     = "m1.2xlarge"  # 16 vCPU, 32GB RAM
}

variable "data_node_flavor" {
  description = "Flavor for data-intensive nodes (TigerBeetle, Kafka, PostgreSQL)"
  type        = string
  default     = "m1.4xlarge"  # 32 vCPU, 64GB RAM
}

variable "image_name" {
  description = "OS image for nodes"
  type        = string
  default     = "Ubuntu-22.04-LTS"
}

variable "ssh_public_key" {
  description = "SSH public key for node access"
  type        = string
}

variable "availability_zones" {
  description = "Availability zones for HA deployment"
  type        = list(string)
  default     = ["nova"]
}

# Data Sources
data "openstack_networking_network_v2" "external" {
  name = var.external_network_name
}

data "openstack_images_image_v2" "ubuntu" {
  name        = var.image_name
  most_recent = true
}

# SSH Key Pair
resource "openstack_compute_keypair_v2" "cluster_key" {
  name       = "${var.cluster_name}-key"
  public_key = var.ssh_public_key
}

# Network Infrastructure
resource "openstack_networking_network_v2" "cluster_network" {
  name           = "${var.cluster_name}-network"
  admin_state_up = true
}

resource "openstack_networking_subnet_v2" "cluster_subnet" {
  name            = "${var.cluster_name}-subnet"
  network_id      = openstack_networking_network_v2.cluster_network.id
  cidr            = "10.100.0.0/16"
  ip_version      = 4
  dns_nameservers = var.dns_nameservers
  
  allocation_pool {
    start = "10.100.1.10"
    end   = "10.100.255.250"
  }
}

resource "openstack_networking_router_v2" "cluster_router" {
  name                = "${var.cluster_name}-router"
  admin_state_up      = true
  external_network_id = data.openstack_networking_network_v2.external.id
}

resource "openstack_networking_router_interface_v2" "router_interface" {
  router_id = openstack_networking_router_v2.cluster_router.id
  subnet_id = openstack_networking_subnet_v2.cluster_subnet.id
}

# Security Groups
resource "openstack_networking_secgroup_v2" "control_plane" {
  name        = "${var.cluster_name}-control-plane-sg"
  description = "Security group for Kubernetes control plane nodes"
}

resource "openstack_networking_secgroup_v2" "worker" {
  name        = "${var.cluster_name}-worker-sg"
  description = "Security group for Kubernetes worker nodes"
}

resource "openstack_networking_secgroup_v2" "data" {
  name        = "${var.cluster_name}-data-sg"
  description = "Security group for data nodes (PostgreSQL, TigerBeetle, Kafka)"
}

resource "openstack_networking_secgroup_v2" "lb" {
  name        = "${var.cluster_name}-lb-sg"
  description = "Security group for load balancer"
}

# Control Plane Security Group Rules
resource "openstack_networking_secgroup_rule_v2" "cp_ssh" {
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  port_range_min    = 22
  port_range_max    = 22
  remote_ip_prefix  = "0.0.0.0/0"
  security_group_id = openstack_networking_secgroup_v2.control_plane.id
}

resource "openstack_networking_secgroup_rule_v2" "cp_api_server" {
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  port_range_min    = 6443
  port_range_max    = 6443
  remote_ip_prefix  = "0.0.0.0/0"
  security_group_id = openstack_networking_secgroup_v2.control_plane.id
}

resource "openstack_networking_secgroup_rule_v2" "cp_etcd" {
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  port_range_min    = 2379
  port_range_max    = 2380
  remote_group_id   = openstack_networking_secgroup_v2.control_plane.id
  security_group_id = openstack_networking_secgroup_v2.control_plane.id
}

resource "openstack_networking_secgroup_rule_v2" "cp_kubelet" {
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  port_range_min    = 10250
  port_range_max    = 10252
  remote_ip_prefix  = "10.100.0.0/16"
  security_group_id = openstack_networking_secgroup_v2.control_plane.id
}

# Worker Security Group Rules
resource "openstack_networking_secgroup_rule_v2" "worker_ssh" {
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  port_range_min    = 22
  port_range_max    = 22
  remote_group_id   = openstack_networking_secgroup_v2.control_plane.id
  security_group_id = openstack_networking_secgroup_v2.worker.id
}

resource "openstack_networking_secgroup_rule_v2" "worker_kubelet" {
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  port_range_min    = 10250
  port_range_max    = 10250
  remote_ip_prefix  = "10.100.0.0/16"
  security_group_id = openstack_networking_secgroup_v2.worker.id
}

resource "openstack_networking_secgroup_rule_v2" "worker_nodeport" {
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  port_range_min    = 30000
  port_range_max    = 32767
  remote_ip_prefix  = "0.0.0.0/0"
  security_group_id = openstack_networking_secgroup_v2.worker.id
}

resource "openstack_networking_secgroup_rule_v2" "worker_http" {
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  port_range_min    = 80
  port_range_max    = 80
  remote_ip_prefix  = "0.0.0.0/0"
  security_group_id = openstack_networking_secgroup_v2.worker.id
}

resource "openstack_networking_secgroup_rule_v2" "worker_https" {
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  port_range_min    = 443
  port_range_max    = 443
  remote_ip_prefix  = "0.0.0.0/0"
  security_group_id = openstack_networking_secgroup_v2.worker.id
}

# Data Node Security Group Rules
resource "openstack_networking_secgroup_rule_v2" "data_postgres" {
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  port_range_min    = 5432
  port_range_max    = 5432
  remote_ip_prefix  = "10.100.0.0/16"
  security_group_id = openstack_networking_secgroup_v2.data.id
}

resource "openstack_networking_secgroup_rule_v2" "data_tigerbeetle" {
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  port_range_min    = 3001
  port_range_max    = 3001
  remote_ip_prefix  = "10.100.0.0/16"
  security_group_id = openstack_networking_secgroup_v2.data.id
}

resource "openstack_networking_secgroup_rule_v2" "data_kafka" {
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  port_range_min    = 9092
  port_range_max    = 9094
  remote_ip_prefix  = "10.100.0.0/16"
  security_group_id = openstack_networking_secgroup_v2.data.id
}

resource "openstack_networking_secgroup_rule_v2" "data_redis" {
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  port_range_min    = 6379
  port_range_max    = 6379
  remote_ip_prefix  = "10.100.0.0/16"
  security_group_id = openstack_networking_secgroup_v2.data.id
}

resource "openstack_networking_secgroup_rule_v2" "data_zookeeper" {
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  port_range_min    = 2181
  port_range_max    = 2181
  remote_ip_prefix  = "10.100.0.0/16"
  security_group_id = openstack_networking_secgroup_v2.data.id
}

# Load Balancer Security Group Rules
resource "openstack_networking_secgroup_rule_v2" "lb_http" {
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  port_range_min    = 80
  port_range_max    = 80
  remote_ip_prefix  = "0.0.0.0/0"
  security_group_id = openstack_networking_secgroup_v2.lb.id
}

resource "openstack_networking_secgroup_rule_v2" "lb_https" {
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  port_range_min    = 443
  port_range_max    = 443
  remote_ip_prefix  = "0.0.0.0/0"
  security_group_id = openstack_networking_secgroup_v2.lb.id
}

resource "openstack_networking_secgroup_rule_v2" "lb_api" {
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  port_range_min    = 6443
  port_range_max    = 6443
  remote_ip_prefix  = "0.0.0.0/0"
  security_group_id = openstack_networking_secgroup_v2.lb.id
}

# Internal cluster communication (all nodes)
resource "openstack_networking_secgroup_rule_v2" "internal_all_tcp" {
  for_each = toset([
    openstack_networking_secgroup_v2.control_plane.id,
    openstack_networking_secgroup_v2.worker.id,
    openstack_networking_secgroup_v2.data.id
  ])
  
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  port_range_min    = 1
  port_range_max    = 65535
  remote_ip_prefix  = "10.100.0.0/16"
  security_group_id = each.value
}

resource "openstack_networking_secgroup_rule_v2" "internal_all_udp" {
  for_each = toset([
    openstack_networking_secgroup_v2.control_plane.id,
    openstack_networking_secgroup_v2.worker.id,
    openstack_networking_secgroup_v2.data.id
  ])
  
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "udp"
  port_range_min    = 1
  port_range_max    = 65535
  remote_ip_prefix  = "10.100.0.0/16"
  security_group_id = each.value
}

# Cinder Volumes for Persistent Storage
resource "openstack_blockstorage_volume_v3" "postgres_data" {
  count             = 3  # HA PostgreSQL
  name              = "${var.cluster_name}-postgres-data-${count.index}"
  size              = 500  # GB
  availability_zone = var.availability_zones[count.index % length(var.availability_zones)]
  
  metadata = {
    cluster     = var.cluster_name
    environment = var.environment
    service     = "postgresql"
    encrypted   = "true"
  }
}

resource "openstack_blockstorage_volume_v3" "tigerbeetle_data" {
  count             = 3  # TigerBeetle replicas
  name              = "${var.cluster_name}-tigerbeetle-data-${count.index}"
  size              = 200  # GB - SSD recommended
  availability_zone = var.availability_zones[count.index % length(var.availability_zones)]
  volume_type       = "ssd"  # High IOPS required
  
  metadata = {
    cluster     = var.cluster_name
    environment = var.environment
    service     = "tigerbeetle"
    encrypted   = "true"
  }
}

resource "openstack_blockstorage_volume_v3" "kafka_data" {
  count             = 3  # Kafka brokers
  name              = "${var.cluster_name}-kafka-data-${count.index}"
  size              = 1000  # GB
  availability_zone = var.availability_zones[count.index % length(var.availability_zones)]
  
  metadata = {
    cluster     = var.cluster_name
    environment = var.environment
    service     = "kafka"
    encrypted   = "true"
  }
}

resource "openstack_blockstorage_volume_v3" "redis_data" {
  count             = 3  # Redis Sentinel
  name              = "${var.cluster_name}-redis-data-${count.index}"
  size              = 50  # GB
  availability_zone = var.availability_zones[count.index % length(var.availability_zones)]
  volume_type       = "ssd"
  
  metadata = {
    cluster     = var.cluster_name
    environment = var.environment
    service     = "redis"
    encrypted   = "true"
  }
}

resource "openstack_blockstorage_volume_v3" "vault_data" {
  count             = 3  # Vault HA
  name              = "${var.cluster_name}-vault-data-${count.index}"
  size              = 50  # GB
  availability_zone = var.availability_zones[count.index % length(var.availability_zones)]
  volume_type       = "ssd"
  
  metadata = {
    cluster     = var.cluster_name
    environment = var.environment
    service     = "vault"
    encrypted   = "true"
  }
}

resource "openstack_blockstorage_volume_v3" "rustfs_data" {
  count             = 3  # RustFS distributed storage
  name              = "${var.cluster_name}-rustfs-data-${count.index}"
  size              = 2000  # GB - Object storage
  availability_zone = var.availability_zones[count.index % length(var.availability_zones)]
  
  metadata = {
    cluster     = var.cluster_name
    environment = var.environment
    service     = "rustfs"
    encrypted   = "true"
  }
}

# Control Plane Nodes
resource "openstack_compute_instance_v2" "control_plane" {
  count             = var.control_plane_count
  name              = "${var.cluster_name}-cp-${count.index}"
  flavor_name       = var.control_plane_flavor
  image_id          = data.openstack_images_image_v2.ubuntu.id
  key_pair          = openstack_compute_keypair_v2.cluster_key.name
  availability_zone = var.availability_zones[count.index % length(var.availability_zones)]
  
  security_groups = [
    openstack_networking_secgroup_v2.control_plane.name
  ]
  
  network {
    uuid = openstack_networking_network_v2.cluster_network.id
  }
  
  user_data = base64encode(templatefile("${path.module}/templates/control-plane-init.sh", {
    cluster_name = var.cluster_name
    node_index   = count.index
    node_role    = "control-plane"
  }))
  
  metadata = {
    cluster     = var.cluster_name
    environment = var.environment
    role        = "control-plane"
  }
  
  depends_on = [openstack_networking_router_interface_v2.router_interface]
}

# Worker Nodes
resource "openstack_compute_instance_v2" "worker" {
  count             = var.worker_count
  name              = "${var.cluster_name}-worker-${count.index}"
  flavor_name       = var.worker_flavor
  image_id          = data.openstack_images_image_v2.ubuntu.id
  key_pair          = openstack_compute_keypair_v2.cluster_key.name
  availability_zone = var.availability_zones[count.index % length(var.availability_zones)]
  
  security_groups = [
    openstack_networking_secgroup_v2.worker.name
  ]
  
  network {
    uuid = openstack_networking_network_v2.cluster_network.id
  }
  
  user_data = base64encode(templatefile("${path.module}/templates/worker-init.sh", {
    cluster_name = var.cluster_name
    node_index   = count.index
    node_role    = "worker"
  }))
  
  metadata = {
    cluster     = var.cluster_name
    environment = var.environment
    role        = "worker"
  }
  
  depends_on = [openstack_networking_router_interface_v2.router_interface]
}

# Data Nodes (dedicated for stateful services)
resource "openstack_compute_instance_v2" "data" {
  count             = 3
  name              = "${var.cluster_name}-data-${count.index}"
  flavor_name       = var.data_node_flavor
  image_id          = data.openstack_images_image_v2.ubuntu.id
  key_pair          = openstack_compute_keypair_v2.cluster_key.name
  availability_zone = var.availability_zones[count.index % length(var.availability_zones)]
  
  security_groups = [
    openstack_networking_secgroup_v2.data.name,
    openstack_networking_secgroup_v2.worker.name
  ]
  
  network {
    uuid = openstack_networking_network_v2.cluster_network.id
  }
  
  user_data = base64encode(templatefile("${path.module}/templates/data-node-init.sh", {
    cluster_name = var.cluster_name
    node_index   = count.index
    node_role    = "data"
  }))
  
  metadata = {
    cluster     = var.cluster_name
    environment = var.environment
    role        = "data"
  }
  
  depends_on = [openstack_networking_router_interface_v2.router_interface]
}

# Attach volumes to data nodes
resource "openstack_compute_volume_attach_v2" "postgres_attach" {
  count       = 3
  instance_id = openstack_compute_instance_v2.data[count.index].id
  volume_id   = openstack_blockstorage_volume_v3.postgres_data[count.index].id
  device      = "/dev/vdb"
}

resource "openstack_compute_volume_attach_v2" "tigerbeetle_attach" {
  count       = 3
  instance_id = openstack_compute_instance_v2.data[count.index].id
  volume_id   = openstack_blockstorage_volume_v3.tigerbeetle_data[count.index].id
  device      = "/dev/vdc"
}

resource "openstack_compute_volume_attach_v2" "kafka_attach" {
  count       = 3
  instance_id = openstack_compute_instance_v2.data[count.index].id
  volume_id   = openstack_blockstorage_volume_v3.kafka_data[count.index].id
  device      = "/dev/vdd"
}

resource "openstack_compute_volume_attach_v2" "redis_attach" {
  count       = 3
  instance_id = openstack_compute_instance_v2.data[count.index].id
  volume_id   = openstack_blockstorage_volume_v3.redis_data[count.index].id
  device      = "/dev/vde"
}

resource "openstack_compute_volume_attach_v2" "vault_attach" {
  count       = 3
  instance_id = openstack_compute_instance_v2.data[count.index].id
  volume_id   = openstack_blockstorage_volume_v3.vault_data[count.index].id
  device      = "/dev/vdf"
}

resource "openstack_compute_volume_attach_v2" "rustfs_attach" {
  count       = 3
  instance_id = openstack_compute_instance_v2.data[count.index].id
  volume_id   = openstack_blockstorage_volume_v3.rustfs_data[count.index].id
  device      = "/dev/vdg"
}

# Floating IPs for external access
resource "openstack_networking_floatingip_v2" "control_plane" {
  count = var.control_plane_count
  pool  = var.external_network_name
}

resource "openstack_compute_floatingip_associate_v2" "control_plane" {
  count       = var.control_plane_count
  floating_ip = openstack_networking_floatingip_v2.control_plane[count.index].address
  instance_id = openstack_compute_instance_v2.control_plane[count.index].id
}

# Load Balancer for API Server
resource "openstack_lb_loadbalancer_v2" "api_lb" {
  name          = "${var.cluster_name}-api-lb"
  vip_subnet_id = openstack_networking_subnet_v2.cluster_subnet.id
  
  security_group_ids = [openstack_networking_secgroup_v2.lb.id]
}

resource "openstack_lb_listener_v2" "api_listener" {
  name            = "${var.cluster_name}-api-listener"
  protocol        = "TCP"
  protocol_port   = 6443
  loadbalancer_id = openstack_lb_loadbalancer_v2.api_lb.id
}

resource "openstack_lb_pool_v2" "api_pool" {
  name        = "${var.cluster_name}-api-pool"
  protocol    = "TCP"
  lb_method   = "ROUND_ROBIN"
  listener_id = openstack_lb_listener_v2.api_listener.id
}

resource "openstack_lb_member_v2" "api_members" {
  count         = var.control_plane_count
  pool_id       = openstack_lb_pool_v2.api_pool.id
  address       = openstack_compute_instance_v2.control_plane[count.index].access_ip_v4
  protocol_port = 6443
  subnet_id     = openstack_networking_subnet_v2.cluster_subnet.id
}

resource "openstack_lb_monitor_v2" "api_monitor" {
  name        = "${var.cluster_name}-api-monitor"
  pool_id     = openstack_lb_pool_v2.api_pool.id
  type        = "TCP"
  delay       = 5
  timeout     = 5
  max_retries = 3
}

# Floating IP for Load Balancer
resource "openstack_networking_floatingip_v2" "api_lb" {
  pool = var.external_network_name
}

resource "openstack_networking_floatingip_associate_v2" "api_lb" {
  floating_ip = openstack_networking_floatingip_v2.api_lb.address
  port_id     = openstack_lb_loadbalancer_v2.api_lb.vip_port_id
}

# Ingress Load Balancer
resource "openstack_lb_loadbalancer_v2" "ingress_lb" {
  name          = "${var.cluster_name}-ingress-lb"
  vip_subnet_id = openstack_networking_subnet_v2.cluster_subnet.id
  
  security_group_ids = [openstack_networking_secgroup_v2.lb.id]
}

resource "openstack_lb_listener_v2" "ingress_http" {
  name            = "${var.cluster_name}-ingress-http"
  protocol        = "TCP"
  protocol_port   = 80
  loadbalancer_id = openstack_lb_loadbalancer_v2.ingress_lb.id
}

resource "openstack_lb_listener_v2" "ingress_https" {
  name            = "${var.cluster_name}-ingress-https"
  protocol        = "TCP"
  protocol_port   = 443
  loadbalancer_id = openstack_lb_loadbalancer_v2.ingress_lb.id
}

resource "openstack_lb_pool_v2" "ingress_http_pool" {
  name        = "${var.cluster_name}-ingress-http-pool"
  protocol    = "TCP"
  lb_method   = "ROUND_ROBIN"
  listener_id = openstack_lb_listener_v2.ingress_http.id
}

resource "openstack_lb_pool_v2" "ingress_https_pool" {
  name        = "${var.cluster_name}-ingress-https-pool"
  protocol    = "TCP"
  lb_method   = "ROUND_ROBIN"
  listener_id = openstack_lb_listener_v2.ingress_https.id
}

resource "openstack_lb_member_v2" "ingress_http_members" {
  count         = var.worker_count
  pool_id       = openstack_lb_pool_v2.ingress_http_pool.id
  address       = openstack_compute_instance_v2.worker[count.index].access_ip_v4
  protocol_port = 80
  subnet_id     = openstack_networking_subnet_v2.cluster_subnet.id
}

resource "openstack_lb_member_v2" "ingress_https_members" {
  count         = var.worker_count
  pool_id       = openstack_lb_pool_v2.ingress_https_pool.id
  address       = openstack_compute_instance_v2.worker[count.index].access_ip_v4
  protocol_port = 443
  subnet_id     = openstack_networking_subnet_v2.cluster_subnet.id
}

resource "openstack_networking_floatingip_v2" "ingress_lb" {
  pool = var.external_network_name
}

resource "openstack_networking_floatingip_associate_v2" "ingress_lb" {
  floating_ip = openstack_networking_floatingip_v2.ingress_lb.address
  port_id     = openstack_lb_loadbalancer_v2.ingress_lb.vip_port_id
}

# Generate Ansible inventory
resource "local_file" "ansible_inventory" {
  content = templatefile("${path.module}/templates/inventory.tpl", {
    control_plane_nodes = [for i, node in openstack_compute_instance_v2.control_plane : {
      name       = node.name
      private_ip = node.access_ip_v4
      public_ip  = openstack_networking_floatingip_v2.control_plane[i].address
    }]
    worker_nodes = [for node in openstack_compute_instance_v2.worker : {
      name       = node.name
      private_ip = node.access_ip_v4
    }]
    data_nodes = [for node in openstack_compute_instance_v2.data : {
      name       = node.name
      private_ip = node.access_ip_v4
    }]
    api_lb_ip     = openstack_networking_floatingip_v2.api_lb.address
    ingress_lb_ip = openstack_networking_floatingip_v2.ingress_lb.address
  })
  filename = "${path.module}/generated/inventory.ini"
}

# Generate kubeconfig template
resource "local_file" "kubeconfig_template" {
  content = templatefile("${path.module}/templates/kubeconfig.tpl", {
    cluster_name = var.cluster_name
    api_server   = openstack_networking_floatingip_v2.api_lb.address
  })
  filename = "${path.module}/generated/kubeconfig.yaml"
}
