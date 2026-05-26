#!/bin/bash
# Payment Switch Platform - Control Plane Node Initialization
# This script runs on first boot via cloud-init

set -euo pipefail

CLUSTER_NAME="${cluster_name}"
NODE_INDEX="${node_index}"
NODE_ROLE="${node_role}"

# Log output
exec > >(tee /var/log/payment-switch-init.log) 2>&1
echo "Starting control plane node initialization at $(date)"

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
    open-iscsi

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

# Sysctl settings
cat <<EOF | tee /etc/sysctl.d/k8s.conf
net.bridge.bridge-nf-call-iptables  = 1
net.bridge.bridge-nf-call-ip6tables = 1
net.ipv4.ip_forward                 = 1
net.ipv4.conf.all.forwarding        = 1
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

# Install Helm
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# Install etcdctl for etcd management
ETCD_VER=v3.5.11
curl -L https://github.com/etcd-io/etcd/releases/download/$${ETCD_VER}/etcd-$${ETCD_VER}-linux-amd64.tar.gz -o /tmp/etcd.tar.gz
tar xzf /tmp/etcd.tar.gz -C /tmp
mv /tmp/etcd-$${ETCD_VER}-linux-amd64/etcdctl /usr/local/bin/
rm -rf /tmp/etcd*

# Set hostname
hostnamectl set-hostname $${CLUSTER_NAME}-cp-$${NODE_INDEX}

# Create marker file
touch /var/lib/payment-switch-init-complete

echo "Control plane node initialization complete at $(date)"
