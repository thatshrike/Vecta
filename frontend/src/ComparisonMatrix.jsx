import React from "react";
import { CheckCircle, XCircle, AlertTriangle } from "lucide-react";

const VerdictCell = ({ verdict }) => {
  if (verdict === "COMPLIANT")
    return <span className="flex items-center justify-center gap-1 text-green-700 font-semibold"><CheckCircle className="w-3.5 h-3.5" />C</span>;
  if (verdict === "NON_COMPLIANT")
    return <span className="flex items-center justify-center gap-1 text-red-700 font-semibold"><XCircle className="w-3.5 h-3.5" />F</span>;
  if (verdict === "INCONCLUSIVE")
    return <span className="flex items-center justify-center gap-1 text-yellow-700 font-semibold"><AlertTriangle className="w-3.5 h-3.5" />?</span>;
  return <span className="text-gray-400">--</span>;
};

const getRiskBadge = (level) => {
  if (level === "Low")    return "bg-green-100 text-green-800 border-green-200";
  if (level === "Medium") return "bg-yellow-100 text-yellow-800 border-yellow-200";
  return "bg-red-100 text-red-800 border-red-200";
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
    return "bg-gray-50";
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-50">
      <div className="p-4 border-b border-gray-200 bg-white shrink-0">
        <h2 className="font-bold text-gray-900 text-base">Bidder Comparison Matrix</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Side-by-side view of all {reports.length} bidders across every evaluated requirement.
        </p>
      </div>

      <div className="overflow-auto flex-1">
        <table className="min-w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-100 border-b border-gray-300">
              <th className="text-left px-3 py-2 font-semibold text-gray-700 min-w-[180px] border-r border-gray-200 sticky left-0 bg-gray-100 z-20">
                Requirement
              </th>
              {reports.map((r) => (
                <th
                  key={r.bid_id}
                  className="px-2 py-2 font-semibold text-gray-700 text-center min-w-[130px] border-r border-gray-200 last:border-r-0"
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className="truncate max-w-[120px]" title={r.bidder_name}>
                      {r.bidder_name}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold uppercase ${getRiskBadge(r.risk_level)}`}>
                        {r.risk_level}
                      </span>
                      <span className="text-gray-500 font-mono text-[10px]">{r.compliance_score}%</span>
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
                <tr key={reqId} className={`border-b border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                  <td className="px-3 py-2 font-mono font-semibold text-gray-700 border-r border-gray-200 sticky left-0 bg-inherit z-10">
                    <div className="flex items-center gap-1.5">
                      {isPolicy && <span className="text-[9px] font-bold uppercase tracking-wide text-blue-600 bg-blue-50 border border-blue-200 px-1 py-0.5 rounded">POL</span>}
                      {isTS && <span className="text-[9px] font-bold uppercase tracking-wide text-purple-600 bg-purple-50 border border-purple-200 px-1 py-0.5 rounded">TS</span>}
                      {!isPolicy && !isTS && <span className="text-[9px] font-bold uppercase tracking-wide text-orange-600 bg-orange-50 border border-orange-200 px-1 py-0.5 rounded">MAN</span>}
                      {reqId}
                    </div>
                  </td>
                  {reports.map((r) => {
                    const verdict = lookup[r.bidder_name]?.[reqId] || null;
                    return (
                      <td
                        key={r.bid_id}
                        className={`px-2 py-2 text-center border-r border-gray-100 last:border-r-0 ${verdict ? getCellBg(verdict) : ""}`}
                      >
                        {verdict ? <VerdictCell verdict={verdict} /> : <span className="text-gray-300">--</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2 border-t border-gray-200 bg-white shrink-0 flex items-center gap-4 text-[10px] text-gray-500 font-medium">
        <span className="font-bold text-gray-700">Legend:</span>
        <span className="flex items-center gap-1 text-green-700"><CheckCircle className="w-3 h-3" /> C = Compliant</span>
        <span className="flex items-center gap-1 text-red-700"><XCircle className="w-3 h-3" /> F = Failed</span>
        <span className="flex items-center gap-1 text-yellow-700"><AlertTriangle className="w-3 h-3" /> ? = Inconclusive</span>
        <span className="ml-auto flex items-center gap-2">
          <span className="bg-orange-50 border border-orange-200 text-orange-600 px-1 rounded">MAN</span> Mandatory
          <span className="bg-blue-50 border border-blue-200 text-blue-600 px-1 rounded">POL</span> Policy
          <span className="bg-purple-50 border border-purple-200 text-purple-600 px-1 rounded">TS</span> Tech Spec
        </span>
      </div>
    </div>
  );
}
