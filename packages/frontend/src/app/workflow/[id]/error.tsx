'use client';

import { RouteError } from '@/components/RouteError';

export default function WorkflowError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError {...props} context="this curriculum" />;
}
