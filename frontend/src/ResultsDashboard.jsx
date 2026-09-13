import React, { useState, useEffect } from 'react';
import IndividualBidderView from './IndividualBidderView';

export default function ResultsDashboard({ reports }) {
  const [localReports, setLocalReports] = useState(reports);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    setLocalReports(reports);
  }, [reports]);

  if (!localReports || localReports.length === 0) return null;

  const handleOverride = async (bidId, reqId, newVerdict, reason) => {
    // Step 1: apply the officer's verdict change to local state immediately (optimistic UI)
    const updatedReports = localReports.map(report => {
      if (report.bid_id !== bidId) return report;
      return {
        ...report,
        line_items: report.line_items.map(item => {
          if (item.requirement_id !== reqId) return item;
          return {
            ...item,
            ai_verdict: item.ai_verdict || item.verdict,
            verdict: newVerdict,
            requires_human_review: false,
            review_reason: reason ? `Officer Override: ${reason}` : 'Officer accepted finding.',
          };
        }),
      };
    });
    setLocalReports(updatedReports);

    // Step 2: send the updated line_items to the backend and let it compute the score.
    // No scoring logic runs here — the formula lives exclusively in
    // parser_main.compute_compliance_score and is called via /recalculate.
    const targetReport = updatedReports.find(r => r.bid_id === bidId);
    if (!targetReport) return;

    try {
      const res = await fetch('http://localhost:8000/recalculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          bid_id: bidId, 
          line_items: targetReport.line_items,
          override: {
            requirement_id: reqId,
            new_verdict: newVerdict,
            reason: reason || 'Officer accepted finding.'
          }
        }),
      });
      if (!res.ok) return; // leave optimistic UI in place on error; don't corrupt state
      const scoreUpdate = await res.json();
      setLocalReports(prev => prev.map(report => {
        if (report.bid_id !== bidId) return report;
        return {
          ...report,
          compliance_score: scoreUpdate.compliance_score,
          coverage: scoreUpdate.coverage,
          pending_review_count: scoreUpdate.pending_review_count,
          risk_level: scoreUpdate.risk_level,
          mandatory_hard_fail: scoreUpdate.mandatory_hard_fail,
        };
      }));
    } catch (_) {
      // Network error — optimistic state is already set; officer sees their override
      // but headline score will be stale until next full analysis. Acceptable degradation.
    }
  };

  const totalBidders = localReports.length;
  const totalClauses = localReports[0]?.line_items?.length || 0;
  
  let highRiskCount = 0;
  let miiCompliantCount = 0;

  localReports.forEach(r => {
    r.line_items?.forEach(item => {
      if (item.verdict === 'NON_COMPLIANT') highRiskCount++;
    });
    const mii = r.line_items?.find(i => i.requirement_id === 'POLICY-001');
    if (mii && mii.verdict === 'COMPLIANT') {
      miiCompliantCount++;
    }
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'COMPLIANT': return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'NON_COMPLIANT': return 'bg-error-container text-on-error-container border-error/30';
      case 'INCONCLUSIVE': return 'bg-amber-100 text-amber-900 border-amber-300';
      default: return 'bg-surface-container-high text-on-surface-variant border-outline-variant';
    }
  };

  const getIcon = (status) => {
    switch (status) {
      case 'COMPLIANT': return 'check_circle';
      case 'NON_COMPLIANT': return 'cancel';
      case 'INCONCLUSIVE': return 'warning';
      default: return 'help';
    }
  };

  const allClauses = localReports[0]?.line_items?.map(i => i.requirement_id) || [];
  const activeReport = localReports.find(r => r.bid_id === activeTab);

  return (
    <div className="flex flex-col w-full">
      {/* Top Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto bg-surface-bright border-b border-outline-variant px-gutter pt-2 sticky top-0 z-10">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-space-md py-2 text-[13px] font-bold font-label-caps uppercase whitespace-nowrap border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'overview' ? 'border-primary text-primary bg-surface-container-lowest' : 'border-transparent text-on-surface-variant hover:bg-surface-container-low hover:text-primary'}`}
        >
          <span className="material-symbols-outlined text-[16px]">dashboard</span>
          Compare All
        </button>
        
        {localReports.map(report => (
          <button
            key={report.bid_id}
            onClick={() => setActiveTab(report.bid_id)}
            className={`px-space-md py-2 text-[13px] font-bold font-label-caps uppercase whitespace-nowrap border-b-2 transition-colors flex items-center gap-2 ${activeTab === report.bid_id ? 'border-secondary text-primary bg-surface-container-lowest' : 'border-transparent text-on-surface-variant hover:bg-surface-container-low hover:text-primary'}`}
          >
            {report.bidder_name}
            {report.risk_level === 'High' && (
              <span className="w-2 h-2 rounded-full bg-error ml-1"></span>
            )}
          </button>
        ))}
      </div>

      <div className="p-4 lg:p-8">
        {activeTab === 'overview' ? (
          <div className="flex flex-col gap-space-lg">
            {/* Metrics Bar */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-space-md">
              <div className="bg-surface-container-lowest border border-outline-variant rounded p-space-md shadow-sm flex flex-col gap-1">
                <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Evaluated Bidders</span>
                <div className="flex items-end gap-2">
                  <span className="font-headline-lg text-headline-lg text-primary">{totalBidders}</span>
                  <span className="font-body-sm text-body-sm text-emerald-600 font-semibold mb-1 bg-emerald-50 px-1 rounded">100% Parsed</span>
                </div>
              </div>
              <div className="bg-surface-container-lowest border border-outline-variant rounded p-space-md shadow-sm flex flex-col gap-1">
                <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Total Clauses / Bidder</span>
                <div className="flex items-end gap-2">
                  <span className="font-headline-lg text-headline-lg text-primary">{totalClauses}</span>
                  <span className="font-body-sm text-body-sm text-on-surface-variant mb-1">Including Stat. Policy</span>
                </div>
              </div>
              <div className="bg-surface-container-lowest border border-outline-variant rounded p-space-md shadow-sm flex flex-col gap-1">
                <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">High Risk Deviations</span>
                <div className="flex items-end gap-2">
                  <span className="font-headline-lg text-headline-lg text-error">{highRiskCount}</span>
                  <span className="font-body-sm text-body-sm text-error font-semibold mb-1 bg-error-container/50 px-1 rounded">Critical</span>
                </div>
              </div>
              <div className="bg-surface-container-lowest border border-outline-variant rounded p-space-md shadow-sm flex flex-col gap-1">
                <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">MII Rule 173 Compliant</span>
                <div className="flex items-end gap-2">
                  <span className="font-headline-lg text-headline-lg text-primary">{miiCompliantCount}/{totalBidders}</span>
                  <span className="font-body-sm text-body-sm text-on-surface-variant mb-1">Bidders</span>
                </div>
              </div>
            </div>

            {/* Bidder Compliance Dossier Grid */}
            <section className="bg-surface-container-lowest border border-outline-variant rounded p-space-lg shadow-sm">
              <h2 className="font-headline-sm text-headline-sm font-bold text-primary mb-space-md">Bidder Compliance Dossier</h2>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-space-md">
                {localReports.map((report, idx) => (
                  <div key={report.bid_id} className="border border-outline-variant rounded bg-surface-bright flex flex-col hover:shadow-md transition-shadow">
                    {/* Header */}
                    <div className="p-space-md border-b border-outline-variant flex items-start justify-between bg-surface-container-lowest rounded-t">
                      <div className="flex items-center gap-space-sm">
                        <div className="w-10 h-10 rounded bg-surface-container-highest flex items-center justify-center font-headline-sm font-bold text-primary border border-outline-variant">
                          B{idx + 1}
                        </div>
                        <div>
                          <h3 className="font-body-lg text-[16px] font-bold text-primary">{report.bidder_name}</h3>
                          <div className="font-mono-data-sm text-mono-data-sm text-on-surface-variant">ID: {report.bid_id}</div>
                        </div>
                      </div>
                      <button 
                        onClick={() => setActiveTab(report.bid_id)}
                        className={`px-space-sm py-1 rounded font-body-sm text-[12px] font-bold flex items-center gap-1 border hover:shadow-sm transition-shadow ${getStatusColor(report.status || (report.risk_level === 'High' ? 'NON_COMPLIANT' : 'COMPLIANT'))}`}
                      >
                        <span className="material-symbols-outlined text-[16px]">visibility</span>
                        Review Bid
                      </button>
                    </div>
                    
                    {/* Body Metrics */}
                    <div className="p-space-md grid grid-cols-2 gap-space-md">
                      <div>
                        <span className="font-label-caps text-label-caps text-on-surface-variant uppercase block mb-1">Technical Match Score</span>
                        {report.compliance_score === "N/A" ? (
                          <div className="flex items-center gap-1 mt-2 mb-1">
                            <span className="font-headline-sm font-bold text-amber-700">Insufficient Data</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${report.compliance_score >= 80 ? 'bg-emerald-500' : report.compliance_score >= 50 ? 'bg-amber-500' : 'bg-error'}`} 
                                style={{ width: `${report.compliance_score}%` }}
                              ></div>
                            </div>
                            <span className="font-mono-data-sm text-mono-data-sm font-bold text-primary">{report.compliance_score}%</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between font-mono-data-sm text-[9px] text-on-surface-variant mt-1 leading-tight">
                          <span>Mandatory×3 + Scored×1 (Excludes pending manual reviews)</span>
                          {report.pending_review_count > 0 && <span className="font-bold text-amber-700">{report.pending_review_count} Pending Review</span>}
                        </div>
                      </div>
                      
                      {report.line_items?.map(item => {
                        if (item.requirement_id.startsWith('POLICY')) {
                          return (
                            <div key={item.requirement_id}>
                              <span className="font-label-caps text-label-caps text-on-surface-variant uppercase block mb-1">{item.requirement_id} Status</span>
                              <span className={`font-mono-data-sm text-[11px] px-1.5 py-0.5 rounded border ${getStatusColor(item.verdict)}`}>
                                {item.verdict}
                              </span>
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Statutory & Technical Clause Evaluation Matrix */}
            <section className="bg-surface-container-lowest border border-outline-variant rounded shadow-sm overflow-hidden flex flex-col">
              <div className="p-space-lg border-b border-outline-variant flex items-center justify-between bg-surface-bright">
                <div>
                  <h2 className="font-headline-sm text-headline-sm font-bold text-primary">Statutory & Technical Clause Evaluation Matrix</h2>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">Side-by-side comparison of all evaluated clauses across bidders.</p>
                </div>
                <button className="px-space-md py-1.5 bg-primary text-on-primary rounded font-body-sm font-semibold hover:bg-stone-800 transition-colors flex items-center gap-1 shadow-sm">
                  <span className="material-symbols-outlined text-[16px]">download</span> Export Matrix (CSV)
                </button>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low border-b-2 border-outline-variant">
                      <th className="p-space-md font-label-caps text-label-caps text-on-surface-variant uppercase w-1/3 min-w-[250px]">
                        Clause / Requirement
                      </th>
                      {localReports.map((report, idx) => (
                        <th key={report.bid_id} className="p-space-md border-l border-outline-variant min-w-[200px]">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded bg-amber-200 text-amber-900 font-mono-data text-[11px] font-bold flex items-center justify-center">
                              B{idx + 1}
                            </span>
                            <div className="font-body-sm font-bold text-primary truncate" title={report.bidder_name}>
                              {report.bidder_name}
                            </div>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {allClauses.map((clauseId, cIdx) => (
                      <tr key={clauseId} className="hover:bg-surface-container-lowest/50 transition-colors bg-surface-bright">
                        <td className="p-space-md align-top">
                          <div className="font-mono-data-sm text-mono-data-sm font-bold text-primary mb-1">{clauseId}</div>
                          <div className="font-body-sm text-[13px] text-on-surface-variant line-clamp-3">
                            {localReports[0]?.line_items?.find(i => i.requirement_id === clauseId)?.evidence?.tender?.text || "Policy requirement"}
                          </div>
                        </td>
                        {localReports.map((report) => {
                          const item = report.line_items?.find(i => i.requirement_id === clauseId);
                          if (!item) return <td key={report.bid_id} className="p-space-md border-l border-outline-variant text-center">-</td>;
                          
                          return (
                            <td key={report.bid_id} className="p-space-md border-l border-outline-variant align-top">
                              <div className={`px-2 py-1 rounded inline-flex items-center gap-1 font-mono-data-sm text-[11px] font-bold mb-2 border ${getStatusColor(item.verdict)}`}>
                                <span className="material-symbols-outlined text-[14px]">{getIcon(item.verdict)}</span>
                                {item.verdict}
                              </div>
                              {item.reason && (
                                <div className="font-body-sm text-[12px] text-on-surface mt-1 border-l-2 border-outline-variant pl-2">
                                  {item.reason}
                                </div>
                              )}
                              {item.review_reason && item.verdict === 'COMPLIANT' && (
                                <div className="font-body-sm text-[11px] text-emerald-800 mt-1 border-l-2 border-emerald-300 pl-2">
                                  {item.review_reason}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        ) : (
          <IndividualBidderView report={activeReport} onOverride={handleOverride} />
        )}
      </div>
    </div>
  );
}
