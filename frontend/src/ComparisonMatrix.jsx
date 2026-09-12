import React, { useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Layers, Filter, Search } from "lucide-react";

const VerdictCell = ({ verdict }) => {
  if (verdict === "COMPLIANT")
    return (
      <span className="inline-flex items-center justify-center gap-1 text-emerald-700 font-mono font-bold text-xs bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
        PASS
      </span>
    );
  if (verdict === "NON_COMPLIANT")
    return (
      <span className="inline-flex items-center justify-center gap-1 text-rose-700 font-mono font-bold text-xs bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
        <XCircle className="w-3.5 h-3.5 text-rose-600" />
        FAIL
      </span>
    );
  if (verdict === "INCONCLUSIVE")
    return (
      <span className="inline-flex items-center justify-center gap-1 text-amber-800 font-mono font-bold text-xs bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
        REV
      </span>
    );
  return <span className="text-slate-400">--</span>;
};

const getRiskBadge = (level) => {
  if (level === "Low")    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (level === "Medium") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-rose-50 text-rose-700 border-rose-200";
};

export default function ComparisonMatrix({ reports }) {
  const [filterType, setFilterType] = useState('ALL'); // 'ALL' | 'MAN' | 'POL' | 'TS'
  const [search, setSearch] = useState('');

  if (!reports || reports.length < 2) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-xs bg-slate-50 p-8 h-full">
        <Layers className="w-10 h-10 mb-2 text-slate-300" />
        <p className="font-semibold text-slate-700">At least 2 bidder submissions required for matrix comparison.</p>
        <p className="text-[11px] text-slate-500 mt-0.5">Please upload more bidder documents in the upload dashboard.</p>
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

  const filtered = sorted.filter(reqId => {
    const isPolicy = reqId.startsWith("POLICY-");
    const isTS = reqId.startsWith("TS-");
    const isMan = !isPolicy && !isTS;

    if (filterType === 'MAN' && !isMan) return false;
    if (filterType === 'POL' && !isPolicy) return false;
    if (filterType === 'TS' && !isTS) return false;

    if (search && !reqId.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const lookup = {};
  reports.forEach((r) => {
    lookup[r.bidder_name] = {};
    (r.line_items || []).forEach((item) => {
      lookup[r.bidder_name][item.requirement_id] = item.verdict;
    });
  });

  const getCellBg = (verdict) => {
    if (verdict === "COMPLIANT")     return "bg-emerald-50/40";
    if (verdict === "NON_COMPLIANT") return "bg-rose-50/40";
    if (verdict === "INCONCLUSIVE")  return "bg-amber-50/40";
    return "";
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50 text-slate-900 font-sans">
      
      {/* Matrix Header */}
      <div className="p-4 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-2xs">
        <div>
          <h2 className="font-black text-slate-900 text-sm tracking-tight flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600" />
            Bidder Comparison Matrix
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Side-by-side compliance audit across all {reports.length} bidders and {allReqIds.length} evaluated clauses.
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search req ID..."
            className="bg-slate-50 border border-slate-200 rounded-md py-1 px-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 w-36"
          />

          <div className="flex items-center bg-slate-100 p-0.5 rounded-md border border-slate-200 text-[11px] font-semibold">
            {[
              { id: 'ALL', label: 'All' },
              { id: 'MAN', label: 'Mandatory' },
              { id: 'POL', label: 'Policy' },
              { id: 'TS', label: 'Tech Specs' }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilterType(f.id)}
                className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                  filterType === f.id
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid Table */}
      <div className="overflow-auto flex-1">
        <table className="min-w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-100 border-b border-slate-200">
              <th className="text-left px-4 py-3 font-bold text-slate-700 min-w-[200px] border-r border-slate-200 sticky left-0 bg-slate-100 z-20">
                Requirement ID
              </th>
              {reports.map((r) => (
                <th
                  key={r.bid_id}
                  className="px-3 py-3 font-semibold text-slate-700 text-center min-w-[150px] border-r border-slate-200 last:border-r-0 bg-slate-100"
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className="font-bold text-slate-900 text-xs truncate max-w-[140px]" title={r.bidder_name}>
                      {r.bidder_name}
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`px-2 py-0.2 rounded-full border text-[10px] font-bold uppercase ${getRiskBadge(r.risk_level)}`}>
                        {r.risk_level} Risk
                      </span>
                      <span className="text-blue-700 font-mono font-bold text-[11px]">{r.compliance_score}%</span>
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filtered.map((reqId, i) => {
              const isPolicy = reqId.startsWith("POLICY-");
              const isTS = reqId.startsWith("TS-");
              return (
                <tr key={reqId} className={`hover:bg-blue-50/30 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}`}>
                  <td className="px-4 py-2.5 font-mono font-semibold text-slate-800 border-r border-slate-200 sticky left-0 bg-inherit z-10">
                    <div className="flex items-center gap-2">
                      {isPolicy && <span className="text-[9px] font-bold uppercase tracking-wide text-blue-700 bg-blue-50 border border-blue-200 px-1 py-0.2 rounded">POL</span>}
                      {isTS && <span className="text-[9px] font-bold uppercase tracking-wide text-indigo-700 bg-indigo-50 border border-indigo-200 px-1 py-0.2 rounded">TS</span>}
                      {!isPolicy && !isTS && <span className="text-[9px] font-bold uppercase tracking-wide text-orange-700 bg-orange-50 border border-orange-200 px-1 py-0.2 rounded">MAN</span>}
                      <span>{reqId}</span>
                    </div>
                  </td>
                  {reports.map((r) => {
                    const verdict = lookup[r.bidder_name]?.[reqId] || null;
                    return (
                      <td
                        key={r.bid_id}
                        className={`px-3 py-2.5 text-center border-r border-slate-200/60 last:border-r-0 ${verdict ? getCellBg(verdict) : ""}`}
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

      {/* Legend Footer */}
      <div className="px-4 py-2.5 border-t border-slate-200 bg-white shrink-0 flex items-center justify-between text-[11px] text-slate-500 font-medium">
        <div className="flex items-center gap-4">
          <span className="font-bold text-slate-700">Legend:</span>
          <span className="flex items-center gap-1 text-emerald-700"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> PASS = Compliant</span>
          <span className="flex items-center gap-1 text-rose-700"><XCircle className="w-3.5 h-3.5 text-rose-600" /> FAIL = Non-Compliant</span>
          <span className="flex items-center gap-1 text-amber-800"><AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> REV = Review Needed</span>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          <span className="bg-orange-50 border border-orange-200 text-orange-700 px-1.5 py-0.5 rounded font-mono font-bold">MAN</span> Mandatory
          <span className="bg-blue-50 border border-blue-200 text-blue-700 px-1.5 py-0.5 rounded font-mono font-bold">POL</span> Policy
          <span className="bg-indigo-50 border border-indigo-200 text-indigo-700 px-1.5 py-0.5 rounded font-mono font-bold">TS</span> Tech Spec
        </div>
      </div>

    </div>
  );
}
