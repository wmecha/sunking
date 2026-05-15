interface CountryRow {
  country: string;
  total: number;
  live: number;
  not_live: number;
  submitted: number;
  needs_pin: number;
}

export function CountryChart({ data }: { data: CountryRow[] }) {
  const top = data.slice(0, 10);
  const max = Math.max(...top.map((d) => Number(d.total)), 1);

  return (
    <div className="space-y-2.5">
      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-green-500 inline-block" />
          Live
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-blue-400 inline-block" />
          In Account
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" />
          Other
        </span>
      </div>

      {top.map((row) => {
        const total = Number(row.total);
        const live = Number(row.live);
        const inAccount = Number(row.not_live);
        const other = total - live - inAccount;
        const livePct = (live / max) * 100;
        const inAccPct = (inAccount / max) * 100;
        const otherPct = Math.max((other / max) * 100, 0);

        return (
          <div key={String(row.country)} className="flex items-center gap-3 group">
            <div className="w-24 text-xs text-gray-500 text-right truncate flex-shrink-0">
              {String(row.country)}
            </div>
            <div className="flex-1 flex items-center h-5 gap-px">
              {live > 0 && (
                <div
                  className="h-full bg-green-500 rounded-l-sm transition-all duration-300 group-hover:opacity-90"
                  style={{ width: `${livePct}%` }}
                  title={`Live: ${live}`}
                />
              )}
              {inAccount > 0 && (
                <div
                  className="h-full bg-blue-400 transition-all duration-300 group-hover:opacity-90"
                  style={{ width: `${inAccPct}%` }}
                  title={`In Account: ${inAccount}`}
                />
              )}
              {other > 0 && (
                <div
                  className="h-full bg-amber-400 rounded-r-sm transition-all duration-300 group-hover:opacity-90"
                  style={{ width: `${otherPct}%` }}
                  title={`Other: ${other}`}
                />
              )}
            </div>
            <div className="text-xs font-semibold text-[#1C2B3A] w-7 text-right flex-shrink-0 tabular-nums">
              {total}
            </div>
          </div>
        );
      })}
    </div>
  );
}
