import { cn } from "@/lib/utils";

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-muted",
        className
      )}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-6 space-y-3">
      <Shimmer className="h-4 w-24" />
      <Shimmer className="h-8 w-16" />
      <Shimmer className="h-3 w-32" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="border-b p-4 flex gap-4">
        <Shimmer className="h-4 w-20" />
        <Shimmer className="h-4 w-32" />
        <Shimmer className="h-4 w-24" />
        <Shimmer className="h-4 w-16" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="border-b last:border-0 p-4 flex gap-4">
          <Shimmer className="h-4 w-20" />
          <Shimmer className="h-4 w-32" />
          <Shimmer className="h-4 w-24" />
          <Shimmer className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Shimmer className="h-8 w-48" />
        <Shimmer className="h-4 w-64" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <Shimmer className="h-5 w-32" />
          <Shimmer className="h-48 w-full rounded-lg" />
        </div>
        <TableSkeleton rows={4} />
      </div>
    </div>
  );
}

export function ListSkeleton({ items = 6 }: { items?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: items }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border bg-card p-4 flex items-center gap-4"
        >
          <Shimmer className="h-10 w-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Shimmer className="h-4 w-3/4" />
            <Shimmer className="h-3 w-1/2" />
          </div>
          <Shimmer className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-6 space-y-6 max-w-2xl">
      <div className="space-y-2">
        <Shimmer className="h-6 w-40" />
        <Shimmer className="h-4 w-64" />
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Shimmer className="h-4 w-24" />
          <Shimmer className="h-10 w-full rounded-md" />
        </div>
      ))}
      <Shimmer className="h-10 w-32 rounded-md" />
    </div>
  );
}
