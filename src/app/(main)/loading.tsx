import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="container mx-auto px-3 sm:px-6 max-w-7xl pt-6 pb-20 space-y-6 animate-in fade-in duration-150">
      {/* 頂部導覽/切換列骨架 */}
      <div className="h-14 w-full rounded-2xl bg-[#0a0f1c]/90 border border-white/[0.06] px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-28 rounded-lg bg-white/[0.06]" />
          <Skeleton className="h-8 w-32 rounded-lg bg-white/[0.04]" />
        </div>
        <Skeleton className="h-6 w-36 rounded-lg bg-white/[0.05] hidden sm:block" />
      </div>

      {/* 主內容卡片網格骨架 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div
            key={idx}
            className="rounded-2xl bg-[#0a0f1c]/90 border border-white/[0.06] p-4 space-y-3"
          >
            <Skeleton className="h-44 w-full rounded-xl bg-white/[0.05]" />
            <Skeleton className="h-5 w-3/4 rounded bg-white/[0.06]" />
            <Skeleton className="h-4 w-1/2 rounded bg-white/[0.04]" />
          </div>
        ))}
      </div>
    </div>
  );
}
