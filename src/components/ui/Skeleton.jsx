export function SkeletonBox({ className = '' }) {
  return (
    <div className={`bg-gradient-to-r from-purple-50 via-lavender-100 to-purple-50 animate-pulse rounded-xl ${className}`} />
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={`bg-white rounded-2xl border border-purple-50 shadow-card p-4 space-y-3 ${i === 5 || i === 4 ? 'col-span-1' : ''}`}>
            <SkeletonBox className="h-4 w-24" />
            <SkeletonBox className="h-8 w-32" />
            <SkeletonBox className="h-3 w-20" />
          </div>
        ))}
        <div className="col-span-2 bg-white rounded-2xl border border-purple-50 shadow-card p-4 space-y-3">
          <SkeletonBox className="h-4 w-24" />
          <SkeletonBox className="h-8 w-20" />
          <SkeletonBox className="h-3 w-48" />
        </div>
      </div>
      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[0, 1].map(i => (
          <div key={i} className="bg-white rounded-2xl border border-purple-50 shadow-card p-5">
            <SkeletonBox className="h-4 w-40 mb-1" />
            <SkeletonBox className="h-3 w-32 mb-4" />
            <SkeletonBox className="h-48 w-full" />
          </div>
        ))}
      </div>
      {/* Platform cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[0, 1, 2].map(i => (
          <div key={i} className="bg-white rounded-2xl border border-purple-50 shadow-card p-4 space-y-3">
            <SkeletonBox className="h-6 w-24" />
            <SkeletonBox className="h-8 w-28" />
            <SkeletonBox className="h-3 w-32" />
            <SkeletonBox className="h-2 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AnalyticsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-purple-50 shadow-card p-5 space-y-4">
        <div className="flex justify-between">
          <div className="space-y-2">
            <SkeletonBox className="h-6 w-24" />
            <SkeletonBox className="h-4 w-32" />
          </div>
          <SkeletonBox className="h-10 w-24" />
        </div>
        <div className="grid grid-cols-4 gap-3">
          {[0,1,2,3].map(i => <SkeletonBox key={i} className="h-16" />)}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-purple-50 shadow-card p-5">
          <SkeletonBox className="h-4 w-36 mb-4" />
          <SkeletonBox className="h-48 w-full" />
        </div>
        <div className="bg-white rounded-2xl border border-purple-50 shadow-card p-5">
          <SkeletonBox className="h-4 w-36 mb-4" />
          <SkeletonBox className="h-48 w-full" />
        </div>
      </div>
    </div>
  );
}

export function ContentSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[0,1,2,3].map(i => (
          <div key={i} className="bg-white rounded-2xl border border-purple-50 shadow-card p-4 space-y-2">
            <SkeletonBox className="h-9 w-9 rounded-xl" />
            <SkeletonBox className="h-3 w-20" />
            <SkeletonBox className="h-6 w-12" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[0,1].map(i => (
          <div key={i} className="bg-white rounded-2xl border border-purple-50 shadow-card p-5">
            <SkeletonBox className="h-4 w-40 mb-4" />
            <SkeletonBox className="h-44 w-full" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-2xl border border-purple-50 shadow-card p-5 space-y-3">
        <SkeletonBox className="h-4 w-32" />
        {[0,1,2,3,4].map(i => <SkeletonBox key={i} className="h-12 w-full" />)}
      </div>
    </div>
  );
}
