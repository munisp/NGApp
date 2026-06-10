# Payment Switch Platform - OpenStack Terraform Outputs

output "cluster_name" {
  description = "Name of the cluster"
  value       = var.cluster_name
}

output "api_server_url" {
  description = "Kubernetes API server URL"
  value       = "https://${openstack_networking_floatingip_v2.api_lb.address}:6443"
}

output "ingress_ip" {
  description = "Ingress load balancer IP"
  value       = openstack_networking_floatingip_v2.ingress_lb.address
}

output "control_plane_ips" {
  description = "Control plane node IPs"
  value = {
    for i, node in openstack_compute_instance_v2.control_plane : node.name => {
      private_ip = node.access_ip_v4
      public_ip  = openstack_networking_floatingip_v2.control_plane[i].address
    }
  }
}

output "worker_ips" {
  description = "Worker node IPs"
  value = {
    for node in openstack_compute_instance_v2.worker : node.name => node.access_ip_v4
  }
}

output "data_node_ips" {
  description = "Data node IPs"
  value = {
    for node in openstack_compute_instance_v2.data : node.name => node.access_ip_v4
  }
}

output "network_id" {
  description = "Cluster network ID"
  value       = openstack_networking_network_v2.cluster_network.id
}

output "subnet_id" {
  description = "Cluster subnet ID"
  value       = openstack_networking_subnet_v2.cluster_subnet.id
}

output "ssh_command" {
  description = "SSH command to access first control plane node"
  value       = "ssh -i ~/.ssh/payment-switch-key ubuntu@${openstack_networking_floatingip_v2.control_plane[0].address}"
}

output "inventory_file" {
  description = "Path to generated Ansible inventory"
  value       = local_file.ansible_inventory.filename
}

output "kubeconfig_file" {
  description = "Path to generated kubeconfig template"
  value       = local_file.kubeconfig_template.filename
}

output "volume_ids" {
  description = "Cinder volume IDs for persistent storage"
  value = {
    postgres    = [for v in openstack_blockstorage_volume_v3.postgres_data : v.id]
    tigerbeetle = [for v in openstack_blockstorage_volume_v3.tigerbeetle_data : v.id]
    kafka       = [for v in openstack_blockstorage_volume_v3.kafka_data : v.id]
    redis       = [for v in openstack_blockstorage_volume_v3.redis_data : v.id]
    vault       = [for v in openstack_blockstorage_volume_v3.vault_data : v.id]
    rustfs      = [for v in openstack_blockstorage_volume_v3.rustfs_data : v.id]
  }
}
