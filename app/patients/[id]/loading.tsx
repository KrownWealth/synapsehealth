import { SkeletonCard } from '@/components/ui/SkeletonCard';

export default function Loading() {
  return (
    <div className="space-y-5">
      <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
      <div className="h-40 animate-pulse rounded-xl bg-slate-100" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-slate-100" />
        ))}
      </div>
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}
