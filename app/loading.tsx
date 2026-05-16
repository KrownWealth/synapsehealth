import { SkeletonGrid } from '@/components/ui/SkeletonCard';

export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="h-7 w-32 animate-pulse rounded bg-slate-100" />
      <div className="h-10 w-full animate-pulse rounded-lg bg-slate-100" />
      <SkeletonGrid count={6} />
    </div>
  );
}
