#!/bin/bash
# Payment Switch Platform - Data Node Initialization
# This script runs on first boot via cloud-init

set -euo pipefail

CLUSTER_NAME="${cluster_name}"
NODE_INDEX="${node_index}"
NODE_ROLE="${node_role}"

# Log output
exec > >(tee /var/log/payment-switch-init.log) 2>&1
echo "Starting data node initialization at $(date)"

# Update system
apt-get update
apt-get upgrade -y

# Install required packages
apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    software-properties-common \
    jq \
    nfs-common \
    open-iscsi \
    xfsprogs \
    lvm2

# Disable swap
swapoff -a
sed -i '/ swap / s/^\(.*\)$/#\1/g' /etc/fstab

# Load kernel modules
cat <<EOF | tee /etc/modules-load.d/k8s.conf
overlay
br_netfilter
EOF

modprobe overlay
modprobe br_netfilter

# Sysctl settings for data-intensive workloads
cat <<EOF | tee /etc/sysctl.d/k8s.conf
net.bridge.bridge-nf-call-iptables  = 1
net.bridge.bridge-nf-call-ip6tables = 1
net.ipv4.ip_forward                 = 1
net.ipv4.conf.all.forwarding        = 1

# Performance tuning for data nodes
vm.swappiness = 1
vm.dirty_ratio = 40
vm.dirty_background_ratio = 10
net.core.somaxconn = 65535
net.core.netdev_max_backlog = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.tcp_fin_timeout = 10
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_keepalive_time = 60
net.ipv4.tcp_keepalive_intvl = 10
net.ipv4.tcp_keepalive_probes = 6
EOF

sysctl --system

# Install containerd
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update
apt-get install -y containerd.io

# Configure containerd
mkdir -p /etc/containerd
containerd config default | tee /etc/containerd/config.toml
sed -i 's/SystemdCgroup = false/SystemdCgroup = true/g' /etc/containerd/config.toml
systemctl restart containerd
systemctl enable containerd

# Install Kubernetes components
curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.29/deb/Release.key | gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg
echo 'deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.29/deb/ /' | tee /etc/apt/sources.list.d/kubernetes.list
apt-get update
apt-get install -y kubelet kubeadm kubectl
apt-mark hold kubelet kubeadm kubectl

# Enable kubelet
systemctl enable kubelet

# Format and mount data volumes
# Wait for volumes to be attached
sleep 30

# PostgreSQL volume (/dev/vdb)
if [ -b /dev/vdb ]; then
    mkfs.xfs /dev/vdb
    mkdir -p /data/postgresql
    echo '/dev/vdb /data/postgresql xfs defaults,noatime 0 0' >> /etc/fstab
    mount /data/postgresql
fi

# TigerBeetle volume (/dev/vdc) - needs high IOPS
if [ -b /dev/vdc ]; then
    mkfs.xfs /dev/vdc
    mkdir -p /data/tigerbeetle
    echo '/dev/vdc /data/tigerbeetle xfs defaults,noatime,nodiratime 0 0' >> /etc/fstab
    mount /data/tigerbeetle
fi

# Kafka volume (/dev/vdd)
if [ -b /dev/vdd ]; then
    mkfs.xfs /dev/vdd
    mkdir -p /data/kafka
    echo '/dev/vdd /data/kafka xfs defaults,noatime 0 0' >> /etc/fstab
    mount /data/kafka
fi

# Redis volume (/dev/vde)
if [ -b /dev/vde ]; then
    mkfs.xfs /dev/vde
    mkdir -p /data/redis
    echo '/dev/vde /data/redis xfs defaults,noatime 0 0' >> /etc/fstab
    mount /data/redis
fi

# Vault volume (/dev/vdf)
if [ -b /dev/vdf ]; then
    mkfs.xfs /dev/vdf
    mkdir -p /data/vault
    echo '/dev/vdf /data/vault xfs defaults,noatime 0 0' >> /etc/fstab
    mount /data/vault
fi

# RustFS volume (/dev/vdg)
if [ -b /dev/vdg ]; then
    mkfs.xfs /dev/vdg
    mkdir -p /data/rustfs
    echo '/dev/vdg /data/rustfs xfs defaults,noatime 0 0' >> /etc/fstab
    mount /data/rustfs
fi

# Set hostname
hostnamectl set-hostname $${CLUSTER_NAME}-data-$${NODE_INDEX}

# Label this node for data workloads (will be applied after joining cluster)
cat <<EOF > /etc/kubernetes/node-labels.conf
node-role.kubernetes.io/data=true
payment-switch.io/node-type=data
EOF

# Create marker file
touch /var/lib/payment-switch-init-complete

echo "Data node initialization complete at $(date)"
