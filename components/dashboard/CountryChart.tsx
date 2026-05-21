interface CountryRow {
  country: string;
  total: number;
  in_account_verified: number;
  in_account_not_verified: number;
  submitted_claim_awaiting_response: number;
  no_claim_option: number;
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
          Verified
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-blue-400 inline-block" />
          Not verified
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" />
          Submitted
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-red-400 inline-block" />
          No claim
        </span>
      </div>

      {top.map((row) => {
        const total = Number(row.total);
        const verified = Number(row.in_account_verified);
        const notVerified = Number(row.in_account_not_verified);
        const submitted = Number(row.submitted_claim_awaiting_response);
        const noClaim = Number(row.no_claim_option);
        const verifiedPct = (verified / max) * 100;
        const notVerifiedPct = (notVerified / max) * 100;
        const submittedPct = (submitted / max) * 100;
        const noClaimPct = (noClaim / max) * 100;

        return (
          <div key={String(row.country)} className="flex items-center gap-3 group">
            <div className="w-24 text-xs text-gray-500 text-right truncate flex-shrink-0">
              {String(row.country)}
            </div>
            <div className="flex-1 flex items-center h-5 gap-px">
              {verified > 0 && (
                <div
                  className="h-full bg-green-500 rounded-l-sm transition-all duration-300 group-hover:opacity-90"
                  style={{ width: `${verifiedPct}%` }}
                  title={`In account verified: ${verified}`}
                />
              )}
              {notVerified > 0 && (
                <div
                  className="h-full bg-blue-400 transition-all duration-300 group-hover:opacity-90"
                  style={{ width: `${notVerifiedPct}%` }}
                  title={`In account not verified: ${notVerified}`}
                />
              )}
              {submitted > 0 && (
                <div
                  className="h-full bg-amber-400 transition-all duration-300 group-hover:opacity-90"
                  style={{ width: `${submittedPct}%` }}
                  title={`Submitted claim awaiting response: ${submitted}`}
                />
              )}
              {noClaim > 0 && (
                <div
                  className="h-full bg-red-400 rounded-r-sm transition-all duration-300 group-hover:opacity-90"
                  style={{ width: `${noClaimPct}%` }}
                  title={`No claim Option: ${noClaim}`}
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
