export default function TicketDetailSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Header Skeleton */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              {/* Back button skeleton */}
              <div className="w-9 h-9 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse"></div>
              
              <div>
                {/* Title skeleton */}
                <div className="h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-1"></div>
                {/* Channel skeleton */}
                <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              </div>
              
              {/* Status badge skeleton */}
              <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            </div>
            
            {/* Share button skeleton */}
            <div className="h-9 w-20 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse"></div>
          </div>
          
          {/* Metadata skeleton */}
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              {/* Avatar skeleton */}
              <div className="w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
              {/* Author text skeleton */}
              <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            </div>
            <div className="h-4 w-2 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            <div className="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            <div className="h-4 w-2 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            <div className="h-4 w-28 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          </div>
        </div>
      </div>
      
      {/* Messages Container Skeleton */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 py-6">
          {/* AI Summary skeleton */}
          <div className="mb-6">
            <div className="group py-3 px-4 rounded-md">
              <div className="flex gap-3">
                {/* AI avatar skeleton */}
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-300 to-emerald-400 dark:from-emerald-600 dark:to-emerald-700 rounded-full animate-pulse"></div>
                <div className="flex-1 min-w-0">
                  <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2"></div>
                  <div className="space-y-2">
                    <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    <div className="h-4 w-5/6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    <div className="h-4 w-4/6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Date divider skeleton */}
          <div className="flex items-center justify-center my-6">
            <div className="flex-1 border-t border-gray-300 dark:border-gray-600"></div>
            <div className="px-4 py-1 h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
            <div className="flex-1 border-t border-gray-300 dark:border-gray-600"></div>
          </div>
          
          {/* Message skeletons */}
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="py-3 px-4 rounded-md mb-4">
              <div className="flex gap-3">
                {/* Avatar skeleton */}
                <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse flex-shrink-0"></div>
                <div className="flex-1 min-w-0">
                  {/* Author name and timestamp skeleton */}
                  <div className="flex items-center gap-2 mb-1">
                    <div className="h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  </div>
                  {/* Message content skeleton */}
                  <div className="space-y-2">
                    <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    <div className="h-4 w-11/12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    {i % 3 === 0 && <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
