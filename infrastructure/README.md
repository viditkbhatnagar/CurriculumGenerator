# Curriculum Generator App - Infrastructure (DEPRECATED)

> **⚠️ DEPRECATED**: This infrastructure configuration is deprecated. The application has been migrated from Docker/AWS ECS to Render platform with MongoDB Atlas.
>
> **For current deployment instructions, see [DEPLOYMENT.md](../DEPLOYMENT.md)**

This directory contains legacy AWS infrastructure configurations that are no longer in use.

## Migration Notice

The Curriculum Generator App has been migrated to:
- **Platform**: Render (Web Services + Background Workers)
- **Database**: MongoDB Atlas (with vector search)
- **Cache**: Render Redis
- **Storage**: Render Persistent Disk
- **AI Services**: OpenAI (GPT-4 + Embeddings)

## Legacy Components

This directory previously contained:
- Terraform configurations for AWS resources (VPC, ECS, ALB, RDS, ElastiCache)
- ECS task definitions for containerized services
- Docker-based deployment configurations

## Current Deployment

For information on the current deployment architecture and setup:

1. **Setup Guide**: See [SETUP.md](../SETUP.md) for local development
2. **Deployment Guide**: See [DEPLOYMENT.md](../DEPLOYMENT.md) for Render deployment
3. **Architecture**: See [ARCHITECTURE.md](../ARCHITECTURE.md) for system design

## Removal Timeline

This directory is kept for historical reference and will be removed in a future release once the migration is fully validated.
