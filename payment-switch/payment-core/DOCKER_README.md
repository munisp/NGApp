# Docker Deployment - Next-Generation Payment Switch

## Quick Start

```bash
# 1. Create environment file
cp .env.example .env

# 2. Start all services
make up

# 3. Check health
make health
```

## What Gets Deployed

### Core Services (5)
- **Payment Gateway** (Port 8001) - Payment processing
- **Fraud Detection Service** (Port 8002) - AI fraud detection
- **Settlement Service** (Port 8003) - Settlement & reconciliation
- **Offline Payments** (Port 8004) - Offline payment sync
- **Fraud Detection** (Port 8005) - Rule-based fraud checks

### Infrastructure (7)
- **PostgreSQL** (Port 5432) - Primary database with schema
- **Redis** (Port 6379) - Cache and session store
- **Temporal** (Port 7233) - Workflow orchestration
- **Temporal UI** (Port 8080) - Workflow dashboard
- **Prometheus** (Port 9090) - Metrics collection
- **Grafana** (Port 3000) - Monitoring dashboards
- **NGINX** (Port 80) - API gateway with rate limiting

## Common Commands

```bash
# Start services
make up

# View logs
make logs

# Check status
make ps

# Health check
make health

# Stop services
make down

# Restart services
make restart

# Backup database
make backup

# Clean everything
make clean
```

## Access Points

| Service | URL | Credentials |
|---------|-----|-------------|
| API Gateway | http://localhost | - |
| Grafana | http://localhost:3000 | admin / admin_2024 |
| Temporal UI | http://localhost:8080 | - |
| Prometheus | http://localhost:9090 | - |

## API Endpoints

All APIs accessible through NGINX at http://localhost:

- `POST /api/v1/payments/initiate` - Initiate payment
- `POST /api/v1/fraud/score` - Get fraud score
- `POST /api/v1/settlement/execute` - Execute settlement
- `POST /api/v1/offline/sync` - Sync offline payments

## Database

PostgreSQL is automatically initialized with:
- 11 tables (participants, accounts, transactions, etc.)
- Indexes for performance
- Triggers for automation
- Functions for business logic

Connect to database:
```bash
docker-compose exec postgres psql -U payment_user -d payment_switch
```

## Monitoring

### Grafana Dashboards
1. Open http://localhost:3000
2. Login: admin / admin_2024
3. Browse dashboards

### Prometheus Metrics
- http://localhost:9090
- Query: `fraud_score_latency_seconds`
- Query: `scoring_requests_total`

## Troubleshooting

### Services won't start
```bash
docker-compose logs <service-name>
```

### Database issues
```bash
docker-compose exec postgres pg_isready
```

### Port conflicts
Edit `docker-compose.yml` and change port mappings

### Reset everything
```bash
make clean
make up
```

## Production Deployment

1. Change all passwords in `.env`
2. Configure SSL/TLS for NGINX
3. Set up database backups
4. Configure monitoring alerts
5. Review security settings

See `DOCKER_DEPLOYMENT_GUIDE.md` for detailed instructions.

## Architecture

```
Internet → NGINX → Services → Database/Cache
                 ↓
              Monitoring (Prometheus/Grafana)
```

## File Structure

```
nextgen-payment-switch/
├── docker-compose.yml          # Main deployment file
├── .env.example                # Environment template
├── Makefile                    # Deployment commands
├── services/
│   ├── payment-gateway/
│   │   ├── Dockerfile
│   │   ├── main.py
│   │   ├── routers.py
│   │   └── schemas.py
│   ├── fraud-detection-service/
│   │   ├── Dockerfile
│   │   └── ...
│   └── database/
│       └── schema.sql          # Auto-loaded on startup
├── monitoring/
│   ├── prometheus.yml
│   └── grafana/
└── nginx/
    └── nginx.conf
```

## Support

- Full guide: `DOCKER_DEPLOYMENT_GUIDE.md`
- API docs: http://localhost:8001/docs (after deployment)
- Logs: `make logs`
