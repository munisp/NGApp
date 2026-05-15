# 54Bank Platform — High Availability Infrastructure Sizing & Architecture

## Executive Summary

The 54Bank platform comprises **461 microservices** (195 Go, 150 Rust, 80 Python, 36 TypeScript), **14 middleware systems**, **276 database tables**, and **1,054+ API routes**. This document sizes a production-grade HA deployment capable of handling **10,000 concurrent users**, **2,500 TPS peak**, and **99.99% uptime** with zero single points of failure.

**Total servers required: 89 (Primary DC) + 53 (DR DC) = 142 servers**

---

## 1. Architecture Overview

```
                           ┌─────────────────────────────────────┐
                           │         GLOBAL LOAD BALANCER         │
                           │    (Cloudflare / AWS Global Acc.)    │
                           └──────────┬──────────────┬───────────┘
                                      │              │
                    ┌─────────────────┴──┐    ┌──────┴─────────────────┐
                    │   PRIMARY DC        │    │   DR DATA CENTER       │
                    │   (Lagos / Lekki)   │    │   (Abuja)              │
                    │   89 servers        │    │   53 servers           │
                    │   Active            │    │   Active-Passive       │
                    └─────────────────────┘    └───────────────────────┘
```

### Design Principles
- **No single point of failure** — every component runs 3+ replicas
- **Active-Passive DR** — Abuja DC takes over within 15 minutes (RTO)
- **RPO < 5 minutes** — Postgres streaming replication + Kafka MirrorMaker
- **CBN compliance** — quarterly DR testing, data residency in Nigeria
- **Horizontal scaling** — Kubernetes auto-scales services 1x→10x

---

## 2. Primary Data Center — 89 Servers

### 2.1 Kubernetes Cluster — Application Tier (24 servers)

The 461 microservices are grouped into **resource pools** by domain. Each service runs as a Kubernetes Deployment with 2-3 replicas minimum.

| Server Role | Count | Specs (each) | Purpose |
|-------------|-------|-------------|---------|
| **K8s Control Plane** | 3 | 8 vCPU, 16 GB RAM, 200 GB SSD | etcd, API server, scheduler, controller manager |
| **K8s Worker — Core Banking** | 6 | 32 vCPU, 64 GB RAM, 500 GB SSD | Loans, deposits, GL, payments, transfers (120 services × 2 replicas) |
| **K8s Worker — Compliance/AML** | 3 | 16 vCPU, 32 GB RAM, 200 GB SSD | AML, KYC, sanctions, regulatory reporting (50 services × 2 replicas) |
| **K8s Worker — Agriculture** | 3 | 16 vCPU, 32 GB RAM, 200 GB SSD | Agri-finance, cooperatives, livestock, IoT (75 services × 2 replicas) |
| **K8s Worker — Channels** | 3 | 16 vCPU, 32 GB RAM, 200 GB SSD | SMS, USSD, WhatsApp, Telegram, voice (50 services × 2 replicas) |
| **K8s Worker — Infrastructure** | 3 | 16 vCPU, 32 GB RAM, 200 GB SSD | Security, caching, event processing, billing (80 services × 2 replicas) |
| **K8s Worker — ML/Analytics** | 3 | 32 vCPU, 64 GB RAM, 500 GB SSD, 1× GPU | Fraud detection, credit scoring, predictions (20 services, GPU inference) |

**Subtotal: 24 servers | ~576 vCPU | ~1,152 GB RAM**

#### Pod Resource Allocation per Service Type
| Service Type | CPU Request | CPU Limit | Memory Request | Memory Limit | Replicas |
|-------------|------------|-----------|---------------|-------------|----------|
| Go service | 100m | 500m | 128 MB | 512 MB | 2 |
| Rust service | 100m | 500m | 64 MB | 256 MB | 2 |
| Python service | 200m | 1000m | 256 MB | 1 GB | 2 |
| TypeScript gateway | 500m | 2000m | 512 MB | 2 GB | 3 |
| ML inference | 1000m | 4000m | 2 GB | 8 GB | 2 |

### 2.2 Database Tier — PostgreSQL (9 servers)

| Server Role | Count | Specs (each) | Purpose |
|-------------|-------|-------------|---------|
| **Postgres Primary** | 1 | 32 vCPU, 128 GB RAM, 2 TB NVMe RAID-10 | 276 tables, write master |
| **Postgres Sync Standby** | 2 | 32 vCPU, 128 GB RAM, 2 TB NVMe RAID-10 | Synchronous replication, automatic failover (Patroni) |
| **Postgres Read Replicas** | 3 | 16 vCPU, 64 GB RAM, 1 TB NVMe | Read-heavy queries (reports, dashboards, search) |
| **PgBouncer** | 3 | 4 vCPU, 8 GB RAM, 50 GB SSD | Connection pooling (max 10,000 connections → 200 backend) |

**Subtotal: 9 servers | 180 vCPU | 584 GB RAM | 10 TB storage**

#### Database Sizing
| Metric | Value |
|--------|-------|
| Tables | 276 |
| Estimated rows (Year 1) | ~500M |
| Estimated size (Year 1) | ~800 GB |
| Peak connections | 10,000 (pooled to 200) |
| WAL generation | ~50 GB/day |
| Backup retention | 30 days + monthly archives |

### 2.3 Middleware Tier (36 servers)

#### Kafka Cluster (6 servers)
| Server Role | Count | Specs | Purpose |
|-------------|-------|-------|---------|
| **Kafka Broker** | 3 | 16 vCPU, 64 GB RAM, 2 TB NVMe | 156 topics, 12 partitions each, 3× replication |
| **Kafka Controller (KRaft)** | 3 | 8 vCPU, 16 GB RAM, 200 GB SSD | Metadata management (replaces ZooKeeper) |

#### Redis Cluster (6 servers)
| Server Role | Count | Specs | Purpose |
|-------------|-------|-------|---------|
| **Redis Cluster Node** | 6 | 8 vCPU, 32 GB RAM, 200 GB NVMe | 3 masters + 3 replicas, 100K ops/sec, session/cache/rate-limit |

#### TigerBeetle Cluster (3 servers)
| Server Role | Count | Specs | Purpose |
|-------------|-------|-------|---------|
| **TigerBeetle Node** | 3 | 16 vCPU, 32 GB RAM, 500 GB NVMe | Financial ledger, 250K accounts, 1M+ transfers/day, 3-node consensus |

#### Temporal Cluster (6 servers)
| Server Role | Count | Specs | Purpose |
|-------------|-------|-------|---------|
| **Temporal Server** | 3 | 8 vCPU, 16 GB RAM, 200 GB SSD | Workflow orchestration (frontend, history, matching, worker services) |
| **Temporal Worker** | 3 | 8 vCPU, 16 GB RAM, 100 GB SSD | 7 task queues, 100+ workflows |

#### OpenSearch Cluster (3 servers)
| Server Role | Count | Specs | Purpose |
|-------------|-------|-------|---------|
| **OpenSearch Node** | 3 | 16 vCPU, 64 GB RAM, 1 TB NVMe | Full-text search, audit logs, transaction search, 3-node cluster |

#### Keycloak Cluster (3 servers)
| Server Role | Count | Specs | Purpose |
|-------------|-------|-------|---------|
| **Keycloak Node** | 3 | 8 vCPU, 16 GB RAM, 100 GB SSD | SSO/OAuth2, 125K users, 2 realms, Infinispan clustering |

#### Other Middleware (9 servers)
| Server Role | Count | Specs | Purpose |
|-------------|-------|-------|---------|
| **APISIX Gateway** | 3 | 8 vCPU, 16 GB RAM, 100 GB SSD | API gateway, rate limiting, WAF, partner routing |
| **Permify** | 3 | 4 vCPU, 8 GB RAM, 50 GB SSD | Fine-grained authorization (Zanzibar-style) |
| **Fluvio** | 3 | 8 vCPU, 16 GB RAM, 200 GB SSD | Real-time streaming (fraud scoring, CDC) |

**Subtotal: 36 servers | ~360 vCPU | ~960 GB RAM**

### 2.4 Supporting Infrastructure (14 servers)

| Server Role | Count | Specs | Purpose |
|-------------|-------|-------|---------|
| **HAProxy / Load Balancer** | 2 | 8 vCPU, 16 GB RAM, 100 GB SSD | L4/L7 load balancing, SSL termination, VRRP failover |
| **Monitoring (Prometheus + Grafana)** | 2 | 16 vCPU, 64 GB RAM, 1 TB SSD | Metrics (461 services × 50 metrics), dashboards, alerting |
| **Logging (Loki / ELK)** | 2 | 16 vCPU, 64 GB RAM, 2 TB SSD | Centralized logging, 30-day retention, ~100 GB/day |
| **Vault (HashiCorp)** | 3 | 4 vCPU, 8 GB RAM, 100 GB SSD | Secrets management, auto-rotation, 3-node Raft |
| **MinIO / Object Storage** | 3 | 8 vCPU, 16 GB RAM, 4 TB HDD | Document storage, report archives, backups |
| **CI/CD Runner** | 2 | 16 vCPU, 32 GB RAM, 500 GB SSD | GitLab/GitHub Actions runners, Docker builds |

**Subtotal: 14 servers | ~168 vCPU | ~416 GB RAM**

### 2.5 Network & Security (5 servers)

| Server Role | Count | Specs | Purpose |
|-------------|-------|-------|---------|
| **Firewall / WAF** | 2 | 8 vCPU, 16 GB RAM, 100 GB SSD | OpenAppSec WAF, DDoS mitigation, IPS/IDS |
| **VPN Gateway** | 1 | 4 vCPU, 8 GB RAM, 50 GB SSD | Site-to-site VPN (Lagos ↔ Abuja), admin VPN |
| **DNS (Internal)** | 2 | 2 vCPU, 4 GB RAM, 50 GB SSD | CoreDNS for service discovery |

**Subtotal: 5 servers | 24 vCPU | 60 GB RAM**

---

## 3. DR Data Center (Abuja) — 53 Servers

Active-passive with reduced capacity (60% of primary), designed to handle full load during failover.

| Tier | Primary Servers | DR Servers | Notes |
|------|----------------|------------|-------|
| K8s Control Plane | 3 | 3 | Full parity |
| K8s Workers | 21 | 12 | Reduced replicas (1 per service), auto-scale on failover |
| Postgres | 9 | 6 | 1 primary + 2 standby + 3 PgBouncer |
| Kafka | 6 | 3 | 3 brokers (KRaft mode) |
| Redis | 6 | 3 | 3-node cluster |
| TigerBeetle | 3 | 3 | Full parity (financial ledger) |
| Temporal | 6 | 3 | Server + workers combined |
| OpenSearch | 3 | 3 | Full parity (audit requirements) |
| Keycloak | 3 | 2 | Active-passive |
| APISIX | 3 | 2 | |
| Other Middleware | 6 | 3 | Permify + Fluvio |
| Infrastructure | 14 | 7 | Monitoring, logging, Vault, storage |
| Network | 5 | 3 | Firewall, VPN, DNS |
| **Total** | **89** | **53** | |

---

## 4. Total Server Summary

```
┌──────────────────────────────────────────────────────────────┐
│                    TOTAL: 142 SERVERS                         │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  PRIMARY DC (Lagos)          DR DC (Abuja)                   │
│  ═══════════════════        ═══════════════                  │
│  89 servers                  53 servers                      │
│  ~1,308 vCPU                ~780 vCPU                        │
│  ~3,172 GB RAM              ~1,900 GB RAM                    │
│  ~30 TB storage             ~18 TB storage                   │
│                                                              │
│  COMBINED TOTALS:                                            │
│  ─────────────────                                           │
│  vCPU:    ~2,088                                             │
│  RAM:     ~5,072 GB (~5 TB)                                  │
│  Storage: ~48 TB                                             │
│  Network: 10 Gbps inter-DC                                   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 5. Capacity Planning

### 5.1 Performance Targets

| Metric | Target | Architecture Support |
|--------|--------|---------------------|
| Peak TPS | 2,500 | 461 services × 2 replicas, APISIX load balancing |
| Concurrent Users | 10,000 | PgBouncer pooling, Redis session cache |
| API Latency (p99) | < 500ms | Redis caching, read replicas, connection pooling |
| Availability | 99.99% | 3-node clusters, auto-failover, DR site |
| RTO | < 15 min | Patroni auto-failover (Postgres), K8s rescheduling |
| RPO | < 5 min | Synchronous Postgres replication, Kafka MirrorMaker |
| Storage Growth | ~50 GB/month | NVMe with 24-month runway |
| Backup Window | < 30 min | pg_basebackup + WAL archiving to MinIO |

### 5.2 Scaling Thresholds

| Trigger | Action | Additional Servers |
|---------|--------|-------------------|
| CPU > 70% sustained | Add K8s worker nodes | +3 workers |
| Postgres connections > 80% | Add read replicas | +2 replicas |
| Kafka lag > 10,000 | Add brokers + increase partitions | +2 brokers |
| Storage > 70% | Expand NVMe or add MinIO nodes | +3 storage |
| TPS > 2,000 sustained | Scale APISIX + workers | +3 APISIX + 3 workers |

---

## 6. Network Architecture

```
                    INTERNET
                       │
                ┌──────┴──────┐
                │  Cloudflare  │  DDoS protection, CDN, WAF
                │  (Global)    │  SSL termination
                └──────┬──────┘
                       │
          ┌────────────┴────────────┐
          │                         │
    ┌─────┴─────┐            ┌─────┴─────┐
    │  Lagos DC  │            │  Abuja DC  │
    │            │◄──10Gbps──►│            │
    └─────┬─────┘   MPLS/VPN  └─────┬─────┘
          │                         │
    ┌─────┴──────────────┐    ┌─────┴──────────────┐
    │  DMZ (2 servers)   │    │  DMZ (1 server)    │
    │  HAProxy + WAF     │    │  HAProxy + WAF     │
    └─────┬──────────────┘    └────────────────────┘
          │
    ┌─────┴──────────────────────────────────┐
    │           APPLICATION ZONE              │
    │  ┌──────────┐  ┌──────────┐            │
    │  │ APISIX   │  │ APISIX   │  (L7 GW)  │
    │  │ Gateway  │  │ Gateway  │            │
    │  └────┬─────┘  └────┬─────┘            │
    │       │              │                  │
    │  ┌────┴──────────────┴────┐             │
    │  │   Kubernetes Cluster    │             │
    │  │   461 services          │             │
    │  │   24 worker nodes       │             │
    │  └────┬───────────────────┘             │
    │       │                                  │
    │  ┌────┴──────────────────────┐          │
    │  │   MIDDLEWARE ZONE          │          │
    │  │   Kafka │ Redis │ Temporal │          │
    │  │   TigerBeetle │ OpenSearch │          │
    │  │   Keycloak │ Permify       │          │
    │  └────┬──────────────────────┘          │
    │       │                                  │
    │  ┌────┴──────────────┐                  │
    │  │   DATA ZONE        │                  │
    │  │   Postgres Cluster  │                  │
    │  │   MinIO Storage     │                  │
    │  └────────────────────┘                  │
    └──────────────────────────────────────────┘

    VLANs:
    ├── VLAN 10: DMZ (public-facing)
    ├── VLAN 20: Application (K8s + APISIX)
    ├── VLAN 30: Middleware (Kafka, Redis, etc.)
    ├── VLAN 40: Data (Postgres, MinIO)
    ├── VLAN 50: Management (monitoring, CI/CD, Vault)
    └── VLAN 60: Inter-DC replication
```

---

## 7. Server Specifications Summary

### Recommended Hardware (Per Server Class)

| Class | CPU | RAM | Storage | NIC | Count | Use |
|-------|-----|-----|---------|-----|-------|-----|
| **Compute-L** | 2× Xeon 6430 (32c) | 128 GB DDR5 | 2× 1TB NVMe RAID-1 | 2× 25GbE | 6 | Postgres Primary, ML Workers |
| **Compute-M** | 1× Xeon 6430 (32c) | 64 GB DDR5 | 2× 500GB NVMe RAID-1 | 2× 25GbE | 38 | K8s Workers, Kafka, OpenSearch |
| **Compute-S** | 1× Xeon 6416 (16c) | 32 GB DDR5 | 1× 500GB NVMe | 2× 10GbE | 52 | Redis, Temporal, Keycloak, APISIX |
| **Storage** | 1× Xeon 6416 (16c) | 32 GB DDR5 | 8× 4TB HDD RAID-6 | 2× 25GbE | 6 | MinIO, Logging, Backups |
| **Infra-S** | 1× Xeon 5416 (8c) | 16 GB DDR5 | 1× 200GB SSD | 2× 10GbE | 28 | Control plane, DNS, VPN, PgBouncer |
| **Network** | — | — | — | — | 12 | 4× ToR switches, 2× core, 2× FW, 4× patch |

---

## 8. Cost Estimate (Annual)

### On-Premise (Colocation in Lagos + Abuja)

| Item | Monthly (₦) | Annual (₦) | Annual (USD @₦1,550) |
|------|------------|-----------|---------------------|
| **Hardware (142 servers, amortized 5yr)** | 45,000,000 | 540,000,000 | $348,387 |
| **Colocation (2 DCs, power, cooling)** | 15,000,000 | 180,000,000 | $116,129 |
| **Network (10Gbps inter-DC, internet)** | 8,000,000 | 96,000,000 | $61,935 |
| **Licenses (Postgres, monitoring, etc.)** | 3,000,000 | 36,000,000 | $23,226 |
| **Support & Maintenance** | 5,000,000 | 60,000,000 | $38,710 |
| **DevOps Team (5 engineers)** | 12,500,000 | 150,000,000 | $96,774 |
| **DR Testing (quarterly)** | 1,000,000 | 12,000,000 | $7,742 |
| **TOTAL** | **89,500,000** | **1,074,000,000** | **$692,903** |

### Cloud Alternative (AWS Lagos Region)

| Item | Monthly (USD) | Annual (USD) |
|------|-------------|-------------|
| **EC2 (142 instances, reserved 3yr)** | $28,000 | $336,000 |
| **RDS Multi-AZ (Postgres)** | $4,500 | $54,000 |
| **MSK (Kafka)** | $3,200 | $38,400 |
| **ElastiCache (Redis)** | $2,800 | $33,600 |
| **EKS** | $1,500 | $18,000 |
| **S3 + EBS storage** | $3,000 | $36,000 |
| **Data transfer** | $5,000 | $60,000 |
| **Support (Business)** | $2,000 | $24,000 |
| **TOTAL** | **$50,000** | **$600,000** |

---

## 9. Deployment Strategy

### Phase 1 — Foundation (Month 1-2)
- Deploy K8s cluster (3 control plane + 6 core banking workers)
- Deploy Postgres cluster (1 primary + 2 standby + PgBouncer)
- Deploy Kafka (3 brokers), Redis (6 nodes), Keycloak (3 nodes)
- **Servers: 30**

### Phase 2 — Full Primary (Month 3-4)
- Deploy remaining K8s workers (channels, compliance, agri, infra, ML)
- Deploy TigerBeetle, Temporal, OpenSearch, APISIX, Permify, Fluvio
- Deploy monitoring, logging, Vault, storage
- **Servers: 89 (Primary complete)**

### Phase 3 — DR Site (Month 5-6)
- Deploy Abuja DC with reduced capacity
- Configure Postgres streaming replication
- Configure Kafka MirrorMaker
- DR testing and validation
- **Servers: 142 (Full HA)**

---

## 10. Monitoring & Alerting

| Alert | Threshold | Action |
|-------|-----------|--------|
| Service pod crash | > 2 restarts in 5 min | PagerDuty → on-call engineer |
| Postgres replication lag | > 30 seconds | Alert + investigate |
| Kafka consumer lag | > 10,000 messages | Scale consumers |
| Disk usage | > 80% | Expand storage |
| API error rate | > 1% in 5 min | Alert + auto-rollback |
| DR replication broken | Any interruption | Immediate alert |
| Certificate expiry | < 14 days | Auto-renew or alert |
| Memory usage | > 85% | Scale pods or nodes |

---

*Document Version: 1.0 | Generated: 2026-05-13 | Platform: 54Bank v2.0*
*461 services | 14 middleware | 276 tables | 142 servers for 99.99% HA*
