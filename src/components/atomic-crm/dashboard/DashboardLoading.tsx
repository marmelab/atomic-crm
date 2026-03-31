import { Skeleton } from "@/components/ui/skeleton";

export const DashboardLoading = () => (
  <div className="space-y-6 mt-1">
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="rounded-xl border bg-card p-5 space-y-3">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </div>
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <Skeleton className="h-90 w-full rounded-xl" />
      <Skeleton className="h-90 w-full rounded-xl" />
    </div>
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <Skeleton className="h-130 w-full rounded-xl" />
      <Skeleton className="h-130 w-full rounded-xl" />
    </div>
  </div>
);

export const MobileDashboardLoading = () => (
  <div className="grid grid-cols-1 gap-4 mt-1">
    {Array.from({ length: 4 }).map((_, index) => (
      <div key={index} className="rounded-xl border bg-card p-5 space-y-3">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-3 w-full" />
      </div>
    ))}
  </div>
);
