import { Skeleton } from "@/components/ui/skeleton";

export const LoginSkeleton = () => {
  return (
    <div className="max-w-screen-xl mx-auto h-screen pt-8">
      <div className="h-full">
        <div className="max-w-sm mx-auto h-full flex flex-col justify-center gap-8">
          <Skeleton className="w-full h-[100px]" />
          <Skeleton className="w-4/5 h-[50px]" />
          <Skeleton className="w-full h-9" />
          <Skeleton className="w-full h-9" />
          <Skeleton className="w-full h-9" />
          <Skeleton className="w-2/5 h-9" />
        </div>
      </div>
    </div>
  );
};
