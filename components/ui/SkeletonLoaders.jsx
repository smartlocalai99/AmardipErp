function Skeleton({ className = "" }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-lg bg-slate-200/80 ${className}`}
    />
  );
}

export function MetricSkeletonGrid({ count = 4, columns = "grid-cols-2 lg:grid-cols-4" }) {
  return (
    <section className={`grid gap-3 ${columns}`}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="rounded-2xl bg-white p-4 shadow-sm">
          <Skeleton className="h-2.5 w-20" />
          <Skeleton className="mt-4 h-7 w-14" />
        </div>
      ))}
    </section>
  );
}

export function CardListSkeleton({ count = 4, detailBlocks = 2 }) {
  const detailGridClass = detailBlocks >= 3 ? "grid-cols-3" : "grid-cols-2";

  return (
    <section className="space-y-3 md:hidden">
      {Array.from({ length: count }).map((_, index) => (
        <article
          key={index}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <Skeleton className="h-2.5 w-16" />
              <Skeleton className="mt-3 h-4 w-4/5" />
              <Skeleton className="mt-2 h-3 w-2/3" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>

          <div className={`mt-4 grid ${detailGridClass} gap-2`}>
            {Array.from({ length: detailBlocks }).map((__, blockIndex) => (
              <div key={blockIndex} className="rounded-xl bg-slate-50 px-3 py-2">
                <Skeleton className="h-2 w-14" />
                <Skeleton className="mt-2 h-3 w-20" />
              </div>
            ))}
          </div>
        </article>
      ))}
    </section>
  );
}

export function TableSkeleton({ columns = 8, rows = 6, minWidth = "1120px" }) {
  return (
    <section className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
      <div className="overflow-x-auto">
        <table className="text-left text-xs" style={{ minWidth }}>
          <thead className="bg-slate-100">
            <tr>
              {Array.from({ length: columns }).map((_, index) => (
                <th key={index} className="px-3 py-3">
                  <Skeleton className="h-2.5 w-20" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <tr key={rowIndex}>
                {Array.from({ length: columns }).map((__, columnIndex) => (
                  <td key={columnIndex} className="px-3 py-3">
                    <Skeleton className={columnIndex === 0 ? "h-3 w-32" : "h-3 w-20"} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function DataListSkeleton({
  cardCount = 4,
  cardDetailBlocks = 2,
  columns = 8,
  rows = 6,
  minWidth = "1120px",
}) {
  return (
    <>
      <CardListSkeleton count={cardCount} detailBlocks={cardDetailBlocks} />
      <TableSkeleton columns={columns} rows={rows} minWidth={minWidth} />
    </>
  );
}

export default Skeleton;
