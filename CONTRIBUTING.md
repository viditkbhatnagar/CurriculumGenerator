# Contributing Guide

## Development Setup

1. Follow the setup instructions in README.md
2. Ensure all environment variables are configured
3. Start MongoDB and Redis services locally
4. Run development servers: `npm run dev`

## Code Style

- TypeScript/JavaScript: ESLint + Prettier
- Python: Black + isort
- Pre-commit hooks will automatically format code

## Commit Guidelines

Follow conventional commits:
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes
- `refactor:` Code refactoring
- `test:` Test changes
- `chore:` Build/tooling changes

## Testing

- Write tests for all new features
- Run tests before committing: `npm test`
- Maintain 80% code coverage for business logic

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes with clear commit messages
3. Ensure all tests pass
4. Update documentation if needed
5. Submit PR with description of changes
6. Address review feedback

## Package Structure

- `packages/frontend` - React/Next.js UI components
- `packages/backend` - Express API routes and services
- `packages/ai-service` - Python AI/ML processing
- `packages/shared-types` - Shared TypeScript types

## Adding Dependencies

### Node.js packages:
```bash
# For specific package
cd packages/[package-name]
npm install [dependency]

# For workspace root
npm install -w [package-name] [dependency]
```

### Python packages:
```bash
cd packages/ai-service
source venv/bin/activate
pip install [dependency]
pip freeze > requirements.txt
```

## Database Migrations

Database schema changes should be tracked in migration files.
See `scripts/init-db.sql` for initial schema.

## Environment Variables

Never commit `.env` files. Always update `.env.example` files when adding new variables.
