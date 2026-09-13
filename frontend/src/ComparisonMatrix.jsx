import React from "react";
import { CheckCircle, XCircle, AlertTriangle } from "lucide-react";

const VerdictCell = ({ verdict }) => {
  if (verdict === "COMPLIANT")
    return <span className="flex items-center justify-center gap-1 text-green-700 font-semibold"><CheckCircle className="w-3.5 h-3.5" />C</span>;
  if (verdict === "NON_COMPLIANT")
    return <span className="flex items-center justify-center gap-1 text-red-700 font-semibold"><XCircle className="w-3.5 h-3.5" />F</span>;
  if (verdict === "INCONCLUSIVE")
    return <span className="flex items-center justify-center gap-1 text-yellow-700 font-semibold"><AlertTriangle className="w-3.5 h-3.5" />?</span>;
  return <span className="text-slate-400">--</span>;
};

const getRiskBadge = (level) => {
  if (level === "Low")    return "bg-green-50 text-green-900 border-green-300";
  if (level === "Medium") return "bg-yellow-50 text-yellow-900 border-yellow-300";
  return "bg-red-50 text-red-900 border-red-300";
};

export default function ComparisonMatrix({ reports }) {
  if (!reports || reports.length < 2) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        Upload at least 2 bidder documents to compare them side by side.
      </div>
    );
  }

  const allReqIds = [];
  const seen = new Set();
  reports.forEach((r) => {
    (r.line_items || []).forEach((item) => {
      if (!seen.has(item.requirement_id)) {
        seen.add(item.requirement_id);
        allReqIds.push(item.requirement_id);
      }
    });
  });

  const sorted = [...allReqIds].sort((a, b) => {
    const aScored = a.startsWith("TS-") ? 1 : 0;
    const bScored = b.startsWith("TS-") ? 1 : 0;
    if (aScored !== bScored) return aScored - bScored;
    return a.localeCompare(b);
  });

  const lookup = {};
  reports.forEach((r) => {
    lookup[r.bidder_name] = {};
    (r.line_items || []).forEach((item) => {
      lookup[r.bidder_name][item.requirement_id] = item.verdict;
    });
  });

  const getCellBg = (verdict) => {
    if (verdict === "COMPLIANT")     return "bg-green-50";
    if (verdict === "NON_COMPLIANT") return "bg-red-50";
    if (verdict === "INCONCLUSIVE")  return "bg-yellow-50";
    return "bg-slate-50";
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50">
      <div className="p-4 border-b border-slate-300 bg-white shrink-0">
        <h2 className="font-bold text-slate-900 text-base uppercase tracking-wider">Bidder Comparison Matrix</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Side-by-side view of all {reports.length} bidders across every evaluated requirement.
        </p>
      </div>

      <div className="overflow-auto flex-1">
        <table className="min-w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-100 border-b border-slate-300">
              <th className="text-left px-3 py-2 font-bold text-slate-800 uppercase tracking-wider min-w-[180px] border-r border-slate-300 sticky left-0 bg-slate-100 z-20">
                Requirement
              </th>
              {reports.map((r) => (
                <th
                  key={r.bid_id}
                  className="px-2 py-2 font-bold text-slate-800 text-center min-w-[130px] border-r border-slate-300 last:border-r-0"
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className="truncate max-w-[120px]" title={r.bidder_name}>
                      {r.bidder_name}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className={`px-1.5 py-0.5 rounded-sm border text-[10px] font-bold uppercase ${getRiskBadge(r.risk_level)}`}>
                        {r.risk_level}
                      </span>
                      <span className="text-slate-500 font-mono text-[10px]">{r.compliance_score}%</span>
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((reqId, i) => {
              const isPolicy = reqId.startsWith("POLICY-");
              const isTS = reqId.startsWith("TS-");
              return (
                <tr key={reqId} className={`border-b border-slate-200 ${i % 2 === 0 ? "bg-white" : "bg-slate-50"}`}>
                  <td className="px-3 py-2 font-mono font-semibold text-slate-800 border-r border-slate-300 sticky left-0 bg-inherit z-10">
                    <div className="flex items-center gap-1.5">
                      {isPolicy && <span className="text-[9px] font-bold uppercase tracking-widest text-blue-800 bg-blue-50 border border-blue-300 px-1 py-0.5 rounded-sm">POL</span>}
                      {isTS && <span className="text-[9px] font-bold uppercase tracking-widest text-purple-800 bg-purple-50 border border-purple-300 px-1 py-0.5 rounded-sm">TS</span>}
                      {!isPolicy && !isTS && <span className="text-[9px] font-bold uppercase tracking-widest text-orange-800 bg-orange-50 border border-orange-300 px-1 py-0.5 rounded-sm">MAN</span>}
                      {reqId}
                    </div>
                  </td>
                  {reports.map((r) => {
                    const verdict = lookup[r.bidder_name]?.[reqId] || null;
                    return (
                      <td
                        key={r.bid_id}
                        className={`px-2 py-2 text-center border-r border-slate-300 last:border-r-0 ${verdict ? getCellBg(verdict) : ""}`}
                      >
                        {verdict ? <VerdictCell verdict={verdict} /> : <span className="text-slate-300">--</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2 border-t border-slate-300 bg-slate-100 shrink-0 flex items-center gap-4 text-[10px] text-slate-600 font-medium uppercase tracking-wider">
        <span className="font-bold text-slate-800">Legend:</span>
        <span className="flex items-center gap-1 text-green-800"><CheckCircle className="w-3 h-3" /> C = Compliant</span>
        <span className="flex items-center gap-1 text-red-800"><XCircle className="w-3 h-3" /> F = Failed</span>
        <span className="flex items-center gap-1 text-yellow-800"><AlertTriangle className="w-3 h-3" /> ? = Inconclusive</span>
        <span className="ml-auto flex items-center gap-2">
          <span className="bg-orange-50 border border-orange-300 text-orange-800 px-1 rounded-sm tracking-widest font-bold">MAN</span> Mandatory
          <span className="bg-blue-50 border border-blue-300 text-blue-800 px-1 rounded-sm tracking-widest font-bold">POL</span> Policy
          <span className="bg-purple-50 border border-purple-300 text-purple-800 px-1 rounded-sm tracking-widest font-bold">TS</span> Tech Spec
        </span>
      </div>
    </div>
  );
}
