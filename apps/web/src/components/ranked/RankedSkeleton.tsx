/**
 * Page-level skeleton for /ranked while initial data fetches are in
 * flight. Mirrors the rough heights of Header → Tier → 2-col grid →
 * Stats/Book → Footer so first paint avoids layout shift.
 */
export default function RankedSkeleton() {
  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-pulse">
      <div className="h-12 w-64 rounded-bq bg-bq-inset/80 border-[3px] border-bq-ink/20" />
      <div className="h-40 rounded-bq bg-bq-inset/80 border-[3px] border-bq-ink/20" />
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-7 h-44 rounded-bq bg-bq-inset/80 border-[3px] border-bq-ink/20" />
        <div className="col-span-5 h-44 rounded-bq bg-bq-inset/80 border-[3px] border-bq-ink/20" />
      </div>
      <div className="h-48 rounded-bq bg-bq-inset/80 border-[3px] border-bq-ink/20" />
      <div className="h-16 rounded-bq bg-bq-inset/80 border-[3px] border-bq-ink/20" />
    </div>
  )
}
