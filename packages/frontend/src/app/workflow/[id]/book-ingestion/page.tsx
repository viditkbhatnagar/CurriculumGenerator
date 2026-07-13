'use client';

import { useParams } from 'next/navigation';
import BookIngestionPanel from '@/components/workflow/BookIngestionPanel';

/**
 * Step 5.5 — Book Ingestion page. Reachable at /workflow/{id}/book-ingestion.
 * Kept as a standalone route for now so it doesn't require rewiring the main
 * step navigation; the panel is drop-in for that when ready.
 */
export default function BookIngestionPage() {
  const params = useParams();
  const id = String(params?.id || '');
  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-sage-50">
      <BookIngestionPanel workflowId={id} />
    </div>
  );
}
