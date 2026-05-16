'use client';

import { ErrorPanel } from '@/components/ui/ErrorPanel';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorPanel
      title="Something went wrong"
      message={error.message || 'An unexpected error occurred.'}
      onRetry={reset}
    />
  );
}
