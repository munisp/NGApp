# ─────────────────────────────────────────────────────────────────────────────
# ElastiCache Module — Redis cluster with replication, encryption, and failover
# ─────────────────────────────────────────────────────────────────────────────

variable "project_name"          { type = string }
variable "environment"           { type = string }
variable "vpc_id"                { type = string }
variable "private_subnet_ids"    { type = list(string) }
variable "node_type"             { type = string }
variable "num_cache_nodes"       { type = number }
variable "engine_version"        { type = string }
variable "eks_security_group_id" { type = string }

locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

resource "aws_elasticache_subnet_group" "main" {
  name       = "${local.name_prefix}-redis-subnet"
  subnet_ids = var.private_subnet_ids
}

resource "aws_security_group" "redis" {
  name_prefix = "${local.name_prefix}-redis-"
  vpc_id      = var.vpc_id
  description = "ElastiCache Redis security group"

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [var.eks_security_group_id]
    description     = "Redis from EKS"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${local.name_prefix}-redis-sg" }
}

resource "aws_elasticache_parameter_group" "main" {
  name   = "${local.name_prefix}-redis7-params"
  family = "redis7"

  parameter { name = "maxmemory-policy"  value = "allkeys-lru" }
  parameter { name = "notify-keyspace-events" value = "Ex" }
  parameter { name = "timeout"           value = "300" }
  parameter { name = "tcp-keepalive"     value = "60" }
  parameter { name = "activedefrag"      value = "yes" }
}

resource "aws_elasticache_replication_group" "main" {
  replication_group_id = "${local.name_prefix}-redis"
  description          = "POS-54Link Redis cluster"
  node_type            = var.node_type
  num_cache_clusters   = var.num_cache_nodes
  engine_version       = var.engine_version
  port                 = 6379
  parameter_group_name = aws_elasticache_parameter_group.main.name
  subnet_group_name    = aws_elasticache_subnet_group.main.name
  security_group_ids   = [aws_security_group.redis.id]

  automatic_failover_enabled = var.num_cache_nodes > 1
  multi_az_enabled           = var.num_cache_nodes > 1
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true

  snapshot_retention_limit = var.environment == "production" ? 7 : 1
  snapshot_window          = "03:00-05:00"
  maintenance_window       = "sun:05:00-sun:07:00"

  auto_minor_version_upgrade = true
  apply_immediately          = var.environment != "production"

  tags = { Name = "${local.name_prefix}-redis" }
}

output "primary_endpoint" { value = aws_elasticache_replication_group.main.primary_endpoint_address }
output "reader_endpoint"  { value = aws_elasticache_replication_group.main.reader_endpoint_address }
output "cluster_id"       { value = aws_elasticache_replication_group.main.id }
output "port"             { value = 6379 }
