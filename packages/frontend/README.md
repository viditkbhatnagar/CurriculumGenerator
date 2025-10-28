# Curriculum Generator - Admin Dashboard Frontend

This is the admin dashboard frontend for the Curriculum Generator App, built with Next.js 14, TypeScript, and Tailwind CSS.

## Features Implemented

### 1. Core Infrastructure (Task 15.1)
- ✅ Next.js 14 with App Router and TypeScript
- ✅ Tailwind CSS for styling
- ✅ React Query for server state management
- ✅ Zustand for client state management
- ✅ Responsive layout for desktop and tablet (≥768px)
- ✅ Sidebar navigation with collapsible menu
- ✅ Header with user profile display

### 2. SME Management Interface (Task 15.2)
- ✅ Program list view with status, submission date, and actions
- ✅ Program detail view showing all uploaded data (modules, learning outcomes)
- ✅ Review interface for providing feedback to SMEs
- ✅ Status tracking (draft, submitted, under review, approved)
- ✅ Status update functionality

### 3. Knowledge Base Browser (Task 15.3)
- ✅ Search interface for knowledge base content
- ✅ Source metadata display (title, date, credibility, domain)
- ✅ Filtering by domain, date range, and source type
- ✅ Content preview and full text view
- ✅ Source deletion functionality

### 4. Analytics Dashboard (Task 15.4)
- ✅ Program generation metrics (total programs, success rate, average time)
- ✅ Quality score trends over time with line chart
- ✅ User engagement statistics (active users, programs per user)
- ✅ Visualizations using Recharts library
- ✅ Metrics cards with icons

### 5. Version Control Interface (Task 15.5)
- ✅ Version history display with timestamps and authors
- ✅ Version comparison (diff view) between two versions
- ✅ Restore functionality for previous versions
- ✅ Visual diff highlighting (added, removed, modified)

### 6. Export Functionality (Task 15.6)
- ✅ Export buttons for DOCX, PDF, and SCORM formats
- ✅ Download progress indication
- ✅ Bulk export for multiple programs
- ✅ Export modal with format selection

## Project Structure

```
packages/frontend/
├── src/
│   ├── app/                      # Next.js App Router pages
│   │   ├── admin/               # Admin dashboard routes
│   │   │   ├── analytics/       # Analytics page
│   │   │   ├── knowledge-base/  # Knowledge base browser
│   │   │   ├── programs/        # Program management
│   │   │   │   └── [id]/        # Program detail pages
│   │   │   │       ├── review/  # Review interface
│   │   │   │       └── versions/ # Version history
│   │   │   └── page.tsx         # Dashboard home
│   │   ├── layout.tsx           # Root layout with providers
│   │   └── page.tsx             # Landing page
│   ├── components/              # React components
│   │   ├── analytics/           # Analytics components
│   │   ├── export/              # Export functionality
│   │   ├── knowledge-base/      # Knowledge base browser
│   │   ├── layout/              # Layout components
│   │   ├── programs/            # Program management
│   │   └── versions/            # Version control
│   ├── hooks/                   # Custom React hooks
│   │   ├── useAnalytics.ts     # Analytics data hooks
│   │   ├── useExport.ts        # Export functionality
│   │   ├── useKnowledgeBase.ts # Knowledge base hooks
│   │   ├── usePrograms.ts      # Program management hooks
│   │   └── useVersions.ts      # Version control hooks
│   ├── lib/                     # Utility functions
│   │   └── api.ts              # API client
│   ├── providers/               # React context providers
│   │   └── QueryProvider.tsx   # React Query provider
│   ├── stores/                  # Zustand stores
│   │   ├── authStore.ts        # Authentication state
│   │   └── uiStore.ts          # UI state (sidebar, etc.)
│   └── types/                   # TypeScript type definitions
│       ├── analytics.ts
│       ├── knowledgeBase.ts
│       ├── program.ts
│       └── version.ts
└── package.json
```

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

The application will be available at `http://localhost:3000`.

### Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_AUTH0_DOMAIN=your-auth0-domain
NEXT_PUBLIC_AUTH0_CLIENT_ID=your-client-id
```

## API Integration

The frontend expects the following API endpoints to be available:

### Programs
- `GET /api/programs` - List all programs
- `GET /api/programs/:id` - Get program details
- `PUT /api/programs/:id` - Update program
- `POST /api/programs/feedback` - Submit feedback
- `GET /api/programs/:id/versions` - Get version history
- `GET /api/programs/:id/versions/compare` - Compare versions
- `POST /api/programs/:id/versions/:versionId/restore` - Restore version
- `GET /api/programs/:id/export` - Export program
- `POST /api/programs/bulk-export` - Bulk export

### Knowledge Base
- `GET /api/knowledge-base/sources` - List sources
- `POST /api/knowledge-base/search` - Search sources
- `DELETE /api/knowledge-base/sources/:id` - Delete source

### Analytics
- `GET /api/analytics/dashboard` - Dashboard metrics
- `GET /api/analytics/quality-trends` - Quality score trends
- `GET /api/analytics/users` - User engagement data

## Key Technologies

- **Next.js 14**: React framework with App Router
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first CSS framework
- **React Query**: Server state management
- **Zustand**: Client state management
- **Recharts**: Data visualization library

## Responsive Design

The dashboard is fully responsive and optimized for:
- Desktop (≥1024px)
- Tablet (≥768px)
- Mobile support can be added as needed

## Future Enhancements

- Real-time updates via WebSocket
- Advanced filtering and sorting
- Drag-and-drop file uploads
- Inline editing capabilities
- Dark mode support
- Accessibility improvements (ARIA labels, keyboard navigation)
