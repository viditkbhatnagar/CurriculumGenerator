# Quick Start - Deployment

This is a quick reference guide for common deployment tasks. For detailed information, see [DEPLOYMENT.md](../DEPLOYMENT.md).

## Prerequisites Checklist

- [ ] AWS CLI configured
- [ ] Docker installed
- [ ] Terraform installed
- [ ] Node.js 18+ installed
- [ ] Python 3.11+ installed
- [ ] OpenAI API key
- [ ] Pinecone account
- [ ] Auth0 account
- [ ] Domain name with SSL certificate

## First-Time Setup (30 minutes)

```bash
# 1. Clone and install
git clone https://github.com/your-org/curriculum-generator-app.git
cd curriculum-generator-app
npm install

# 2. Create environment file
cp .env.example .env
# Edit .env with your credentials

# 3. Set up AWS infrastructure
cd infrastructure/terraform
terraform init
terraform plan -out=tfplan
terraform apply tfplan

# 4. Push initial images
cd ../..
./scripts/deploy.sh production all

# 5. Verify deployment
make health-check-production
```

## Daily Development Workflow

```bash
# Start local development
make dev

# Or use Docker
make docker-up

# Run tests
make test

# Check code quality
make lint
```

## Deployment Workflow

### Deploy to Staging (Automatic)

```bash
git checkout develop
git merge feature-branch
git push origin develop
# GitHub Actions will automatically deploy
```

### Deploy to Production (Automatic)

```bash
git checkout main
git merge develop
git push origin main
# GitHub Actions will deploy after manual approval
```

### Manual Deployment

```bash
# Deploy all services
make deploy-production

# Deploy specific service
make deploy-api
make deploy-frontend
make deploy-worker
make deploy-ai
```

## Common Tasks

### View Logs

```bash
# Local
make docker-logs

# Production
make logs-api
make logs-frontend
make logs-worker
make logs-ai
```

### Health Checks

```bash
# Local
make health-check

# Staging
make health-check-staging

# Production
make health-check-production
```

### Backup & Restore

```bash
# Manual backup
make backup

# Restore from backup
aws s3 ls s3://curriculum-app-backups/production/
aws s3 cp s3://curriculum-app-backups/production/TIMESTAMP/postgres_*.sql.gz .
gunzip -c postgres_*.sql.gz | psql $DATABASE_URL
```

### Scaling

```bash
# Scale API service
aws ecs update-service \
  --cluster curriculum-production-cluster \
  --service curriculum-api-service \
  --desired-count 5
```

### Rollback

```bash
# Rollback to previous version
aws ecs update-service \
  --cluster curriculum-production-cluster \
  --service curriculum-api-service \
  --task-definition curriculum-api:PREVIOUS_REVISION
```

## Troubleshooting Quick Fixes

### Service won't start

```bash
# Check logs
make logs-api

# Check task status
aws ecs describe-services \
  --cluster curriculum-production-cluster \
  --services curriculum-api-service
```

### High memory usage

```bash
# Restart service
aws ecs update-service \
  --cluster curriculum-production-cluster \
  --service curriculum-api-service \
  --force-new-deployment
```

### Database connection issues

```bash
# Check security groups
aws ec2 describe-security-groups --group-ids sg-xxx

# Test connection
psql $DATABASE_URL -c "SELECT 1"
```

## Infrastructure Changes

```bash
# Plan changes
make infra-plan

# Apply changes
make infra-apply

# View current state
cd infrastructure/terraform
terraform show
```

## Monitoring

### CloudWatch Dashboards

- AWS Console → CloudWatch → Dashboards
- View: CPU, Memory, Request Count, Error Rate

### Key Metrics to Watch

- API response time (target: <2s p95)
- Error rate (target: <1%)
- CPU utilization (target: <80%)
- Memory utilization (target: <80%)

### Alarms

Set up alarms for:
- High CPU (>80%)
- High error rate (>5%)
- Unhealthy targets
- Failed deployments

## Cost Optimization

```bash
# Check current costs
aws ce get-cost-and-usage \
  --time-period Start=2024-01-01,End=2024-01-31 \
  --granularity MONTHLY \
  --metrics BlendedCost

# Review resource usage
aws ecs describe-clusters --clusters curriculum-production-cluster
```

## Security

```bash
# Rotate secrets
aws secretsmanager update-secret \
  --secret-id curriculum-app-secrets-production \
  --secret-string file://new-secrets.json

# Scan for vulnerabilities
npm audit
docker scan curriculum-frontend:latest

# Review IAM policies
aws iam get-role-policy \
  --role-name curriculum-production-ecs-task-role \
  --policy-name curriculum-production-ecs-task-policy
```

## Emergency Procedures

### Complete System Outage

1. Check AWS Service Health Dashboard
2. Review CloudWatch alarms
3. Check ECS service status
4. Review recent deployments
5. Rollback if needed
6. Contact AWS support if infrastructure issue

### Database Corruption

1. Stop all services
2. Restore from latest backup
3. Verify data integrity
4. Restart services
5. Monitor for issues

### Security Breach

1. Rotate all credentials immediately
2. Review CloudWatch logs for suspicious activity
3. Check IAM access logs
4. Update security groups
5. Notify security team
6. Document incident

## Support Contacts

- **DevOps Team**: devops@example.com
- **AWS Support**: AWS Console → Support
- **On-Call**: Check PagerDuty

## Useful Links

- [Full Deployment Guide](../DEPLOYMENT.md)
- [Infrastructure README](README.md)
- [GitHub Actions](https://github.com/your-org/curriculum-generator-app/actions)
- [AWS Console](https://console.aws.amazon.com)
- [CloudWatch Dashboards](https://console.aws.amazon.com/cloudwatch)

---

**Remember**: Always test in staging before deploying to production!
