# Project Structure

```
curriculum-generator-app/
├── .husky/                          # Git hooks
│   └── pre-commit                   # Pre-commit hook for linting
├── .kiro/                           # Kiro specs and configuration
│   └── specs/
│       └── curriculum-generator-app/
│           ├── design.md            # Architecture and design document
│           ├── requirements.md      # Requirements specification
│           └── tasks.md             # Implementation task list
├── packages/                        # Monorepo packages
│   ├── frontend/                    # Next.js 14 frontend application
│   │   ├── src/
│   │   │   └── app/
│   │   │       ├── layout.tsx       # Root layout
│   │   │       ├── page.tsx         # Home page
│   │   │       └── globals.css      # Global styles
│   │   ├── .env.example             # Environment variables template
│   │   ├── next.config.js           # Next.js configuration
│   │   ├── package.json             # Frontend dependencies
│   │   ├── postcss.config.js        # PostCSS configuration
│   │   ├── tailwind.config.js       # Tailwind CSS configuration
│   │   └── tsconfig.json            # TypeScript configuration
│   ├── backend/                     # Node.js/Express API server
│   │   ├── src/
│   │   │   ├── config/
│   │   │   │   └── index.ts         # Configuration management
│   │   │   └── index.ts             # API server entry point
│   │   ├── .env.example             # Environment variables template
│   │   ├── package.json             # Backend dependencies
│   │   └── tsconfig.json            # TypeScript configuration
│   ├── ai-service/                  # Python FastAPI AI/ML services
│   │   ├── src/
│   │   │   ├── __init__.py          # Package initialization
│   │   │   ├── config.py            # Configuration management
│   │   │   └── main.py              # FastAPI application entry
│   │   ├── .env.example             # Environment variables template
│   │   ├── pyproject.toml           # Python project configuration
│   │   ├── requirements.txt         # Python dependencies
│   │   └── setup.py                 # Package setup
│   └── shared-types/                # Shared TypeScript types
│       ├── src/
│       │   └── index.ts             # Type definitions
│       ├── package.json             # Package configuration
│       └── tsconfig.json            # TypeScript configuration
├── scripts/                         # Utility scripts
│   ├── dev.sh                       # Development startup script
│   ├── init-db.sql                  # Database initialization
│   ├── pinecone-mock.conf           # Pinecone mock configuration
│   └── setup.sh                     # Initial setup script
├── .editorconfig                    # Editor configuration
├── .env.example                     # Root environment template
├── .eslintrc.js                     # ESLint configuration
├── .gitignore                       # Git ignore patterns
├── .lintstagedrc.json               # Lint-staged configuration
├── .prettierrc                      # Prettier configuration
├── CONTRIBUTING.md                  # Contributing guidelines
├── Makefile                         # Make commands
├── package.json                     # Root package configuration
├── QUICKSTART.md                    # Quick start guide
├── README.md                        # Main documentation
└── turbo.json                       # Turborepo configuration
```

## Package Descriptions

### Frontend (`packages/frontend`)
- **Technology**: Next.js 14 with App Router, React 18, TypeScript
- **Styling**: Tailwind CSS
- **State Management**: React Query (server state), Zustand (client state)
- **Purpose**: Admin dashboard and student-facing interfaces

### Backend (`packages/backend`)
- **Technology**: Node.js, Express, TypeScript
- **Database**: PostgreSQL with pg driver
- **Cache**: Redis with Bull for job queues
- **Purpose**: REST API, authentication, business logic orchestration

### AI Service (`packages/ai-service`)
- **Technology**: Python 3.11+, FastAPI
- **AI/ML**: LangChain, OpenAI, Sentence-Transformers
- **Vector DB**: Pinecone client
- **Purpose**: RAG engine, content generation, embeddings

### Shared Types (`packages/shared-types`)
- **Technology**: TypeScript
- **Purpose**: Common type definitions used across packages

## Infrastructure Services

### PostgreSQL
- **Port**: 5432
- **Purpose**: Primary relational database
- **Extensions**: uuid-ossp, pgvector

### Redis
- **Port**: 6379
- **Purpose**: Caching, session management, job queues

### Pinecone Mock
- **Port**: 8080
- **Purpose**: Local development mock for vector database

## Configuration Files

- **turbo.json**: Monorepo build orchestration
- **.eslintrc.js**: JavaScript/TypeScript linting rules
- **.prettierrc**: Code formatting rules
- **tsconfig.json**: TypeScript compiler options (per package)
- **pyproject.toml**: Python project settings

## Scripts

- **setup.sh**: Initial project setup
- **dev.sh**: Start all development servers
- **init-db.sql**: Database schema initialization

## Development Workflow

1. Make changes in relevant package
2. Pre-commit hooks run automatically (lint + format)
3. Turborepo handles build dependencies
4. MongoDB and Redis provide data storage and caching

## Build Outputs

- Frontend: `.next/` directory
- Backend: `dist/` directory
- Shared Types: `dist/` directory
- AI Service: `__pycache__/` (Python bytecode)
