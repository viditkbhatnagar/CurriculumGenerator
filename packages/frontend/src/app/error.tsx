'use client';

import { RouteError } from '@/components/RouteError';

export default function AppError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError {...props} context="this page" backHref="/" backLabel="Back to start" />;
}
