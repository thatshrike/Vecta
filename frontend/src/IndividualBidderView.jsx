import React, { useState } from 'react';

export default function IndividualBidderView({ report, onOverride }) {
  const [selectedReqId, setSelectedReqId] = useState(
    report.line_items?.length > 0 ? report.line_items[0].requirement_id : null
  );
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideLog, setOverrideLog] = useState([]);

  if (!report) return null;

  let compliant = 0;
  let failed = 0;
  let review = 0;
  let pendingActions = [];

  report.line_items?.forEach(item => {
    if (item.verdict === 'COMPLIANT') compliant++;
    else if (item.verdict === 'NON_COMPLIANT') {
      failed++;
      pendingActions.push(item);
    } else if (item.verdict === 'INCONCLUSIVE') {
      review++;
      pendingActions.push(item);
    }
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'COMPLIANT': return 'bg-emerald-50 text-emerald-800 border-emerald-300';
      case 'NON_COMPLIANT': return 'bg-error-container/50 text-on-error-container border-error/50';
      case 'INCONCLUSIVE': return 'bg-amber-50 text-amber-900 border-amber-300';
      default: return 'bg-surface-container text-on-surface-variant border-outline-variant';
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

  const selectedItem = report.line_items?.find(i => i.requirement_id === selectedReqId);

  const handleDecision = (newVerdict) => {
    if (selectedReqId) {
      setOverrideLog(prev => [{
        timestamp: new Date().toLocaleTimeString(),
        reqId: selectedReqId,
        verdict: newVerdict,
        reason: overrideReason || '(no reason given)'
      }, ...prev]);
      onOverride(report.bid_id, selectedReqId, newVerdict, overrideReason);
      setOverrideReason('');
    }
  };

  return (
    <div className="flex flex-col gap-space-lg w-full pb-space-xl px-gutter">
      
      {/* Sticky Bidder Header */}
      <div className="sticky top-0 z-10 bg-surface-container-lowest border border-outline-variant shadow-sm px-space-lg py-space-md rounded-b flex flex-col md:flex-row md:items-center justify-between gap-space-md">
        <div className="flex flex-col gap-1">
          <div className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">BID ID</div>
          <h2 className="font-headline-sm text-headline-sm text-primary font-bold">{report.bid_id}</h2>
          <span className="font-body-sm text-body-sm text-on-surface-variant">{report.bidder_name}</span>
        </div>

        <div className="flex items-center gap-space-lg">
          {report.compliance_score === "N/A" ? (
            <div className="flex flex-col items-center">
              <span className="font-label-caps text-[10px] text-on-surface-variant uppercase">Technical Match Score</span>
              <span className="font-headline-sm font-bold text-amber-700 mt-1">Insufficient Data</span>
              <span className="font-mono-data-sm text-[9px] text-on-surface-variant mt-1">{report.pending_review_count} pending review</span>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <span className="font-label-caps text-[10px] text-on-surface-variant uppercase">Technical Match Score</span>
              <div className="flex items-baseline gap-1">
                <span className="font-headline-md text-headline-md font-bold text-primary">{report.compliance_score}%</span>
              </div>
              <span className="font-mono-data-sm text-[9px] text-on-surface-variant mt-1">Coverage: {Math.round(report.coverage * 100)}%</span>
            </div>
          )}
          
          <div className={`px-space-md py-1.5 rounded font-label-caps text-label-caps font-bold border ${report.risk_level === 'High' ? 'bg-error-container text-on-error-container border-error/30' : report.risk_level === 'Medium' ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-emerald-100 text-emerald-800 border-emerald-300'}`}>
            {report.risk_level === 'High' ? (
              <div className="flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">gpp_bad</span> HIGH RISK</div>
            ) : report.risk_level === 'Medium' ? (
              <div className="flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">warning</span> MEDIUM RISK</div>
            ) : (
              <div className="flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">verified_user</span> LOW RISK</div>
            )}
          </div>
        </div>
      </div>

      {/* Extraction Error Banner */}
      {report.extraction_error && (
        <div className="bg-error-container/30 border border-error/50 rounded p-space-md flex items-start gap-space-sm text-on-error-container">
          <span className="material-symbols-outlined text-error">error</span>
          <div className="flex flex-col">
            <span className="font-bold text-[14px]">PDF Extraction Failed</span>
            <span className="text-[13px] mt-1">{report.extraction_error_detail}</span>
          </div>
        </div>
      )}

      {report.mandatory_hard_fail && (
        <div className="bg-error-container/30 border border-error/50 rounded p-space-md flex items-start gap-space-sm text-on-error-container">
          <span className="material-symbols-outlined text-error">warning</span>
          <div className="flex flex-col">
            <span className="font-bold text-[14px]">Mandatory requirement(s) failed: {report.failed_mandatory_requirements?.join(', ')}.</span>
            <span className="text-[13px] mt-1">{report.recommendation}</span>
          </div>
        </div>
      )}

      {/* 3-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-md items-start">
        
        {/* Left Column: Summary & Queue */}
        <div className="lg:col-span-3 flex flex-col gap-space-md">
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-emerald-50 border border-emerald-200 rounded p-2 flex flex-col items-center justify-center">
              <span className="font-headline-sm font-bold text-emerald-800">{compliant}</span>
              <span className="font-label-caps text-[10px] text-emerald-900 uppercase">Compliant</span>
            </div>
            <div className="bg-error-container/30 border border-error/30 rounded p-2 flex flex-col items-center justify-center">
              <span className="font-headline-sm font-bold text-error">{failed}</span>
              <span className="font-label-caps text-[10px] text-error uppercase">Failed</span>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded p-2 flex flex-col items-center justify-center">
              <span className="font-headline-sm font-bold text-amber-800">{review}</span>
              <span className="font-label-caps text-[10px] text-amber-900 uppercase">Review</span>
            </div>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant rounded flex flex-col overflow-hidden">
            <div className="bg-amber-50 px-space-md py-space-sm border-b border-outline-variant flex items-center justify-between">
              <div className="flex items-center gap-1 font-label-caps text-amber-900 font-bold uppercase text-[11px]">
                <span className="material-symbols-outlined text-[16px]">flag</span> Action Queue
              </div>
              <span className="bg-amber-200 text-amber-900 font-bold text-[10px] px-2 py-0.5 rounded-full">{pendingActions.length} Pending</span>
            </div>
            <div className="flex flex-col max-h-[400px] overflow-y-auto">
              {pendingActions.length === 0 ? (
                <div className="p-space-md text-center text-on-surface-variant font-body-sm text-[12px] opacity-70">
                  No pending actions.
                </div>
              ) : (
                pendingActions.map(action => (
                  <button
                    key={action.requirement_id}
                    onClick={() => setSelectedReqId(action.requirement_id)}
                    className={`text-left p-space-sm border-b border-outline-variant hover:bg-surface-container transition-colors ${selectedReqId === action.requirement_id ? 'bg-surface-container-low' : 'bg-surface-container-lowest'}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-label-caps font-bold text-[11px] text-primary">Verify: {action.requirement_id}</span>
                      <span className="text-[9px] bg-surface-container-highest px-1 py-0.5 rounded font-bold text-on-surface-variant">{action.criticality === 'mandatory' ? 'MAN' : 'OP'}</span>
                    </div>
                    <p className="font-body-sm text-[11px] text-on-surface-variant line-clamp-2">
                      {action.review_reason || action.reason}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Middle Column: Evaluated Requirements List */}
        <div className="lg:col-span-4 bg-surface-container-lowest border border-outline-variant rounded flex flex-col h-[600px]">
          <div className="px-space-md py-space-sm border-b border-outline-variant flex justify-between items-center bg-surface-bright">
            <span className="font-label-caps text-[11px] font-bold text-on-surface-variant uppercase">Evaluated Requirements</span>
            <span className="text-[10px] bg-surface-container-high px-2 py-0.5 rounded text-on-surface-variant font-bold">{report.line_items?.length} Items</span>
          </div>
          <div className="flex-1 overflow-y-auto flex flex-col divide-y divide-outline-variant">
            {report.line_items?.map(item => (
              <button
                key={item.requirement_id}
                onClick={() => setSelectedReqId(item.requirement_id)}
                className={`flex items-center justify-between p-space-md transition-colors hover:bg-surface-container-low text-left ${selectedReqId === item.requirement_id ? 'bg-surface-container border-l-4 border-l-primary' : 'bg-surface-container-lowest border-l-4 border-l-transparent'}`}
              >
                <div className="flex items-center gap-space-sm">
                  <span className={`px-2 py-1 rounded inline-flex items-center gap-1 font-mono-data-sm text-[10px] font-bold border ${getStatusColor(item.verdict)}`}>
                    <span className="material-symbols-outlined text-[14px]">{getIcon(item.verdict)}</span>
                    {item.verdict}
                  </span>
                  <span className="font-mono-data-sm text-[13px] font-bold text-primary">{item.requirement_id}</span>
                </div>
                <span className="material-symbols-outlined text-outline-variant text-[18px]">chevron_right</span>
              </button>
            ))}
          </div>
        </div>

        {/* Right Column: Details & Officer Decision */}
        <div className="lg:col-span-5 flex flex-col gap-space-md">
          {selectedItem ? (
            <>
              <div className="flex items-center justify-between border-b border-outline-variant pb-2">
                <h3 className="font-headline-sm font-bold text-primary">{selectedItem.requirement_id}</h3>
                {selectedItem.requires_human_review && (
                  <span className="px-2 py-1 bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-bold flex items-center gap-1 rounded">
                    <span className="material-symbols-outlined text-[14px]">flag</span> Requires Review
                  </span>
                )}
              </div>

              <div className={`p-space-md rounded border flex flex-col gap-1 ${getStatusColor(selectedItem.verdict)}`}>
                <div className="flex items-center gap-2 font-mono-data-sm text-[12px] font-bold">
                  <span className="material-symbols-outlined">{getIcon(selectedItem.verdict)}</span>
                  {selectedItem.verdict}
                </div>
                {selectedItem.ai_verdict && selectedItem.ai_verdict !== selectedItem.verdict && (
                  <div className="text-[10px] opacity-80 mt-1 pl-6 line-through">
                    Original AI Verdict: {selectedItem.ai_verdict}
                  </div>
                )}
              </div>

              {selectedItem.review_reason && (
                <div className="bg-amber-50 border border-amber-200 p-space-md rounded flex flex-col gap-1">
                  <span className="font-label-caps text-[10px] font-bold text-amber-900 uppercase flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">warning</span> Review Flag Details
                  </span>
                  <span className="font-body-sm text-[13px] text-amber-900">{selectedItem.review_reason}</span>
                </div>
              )}

              {selectedItem.reason && !selectedItem.review_reason && (
                <div className="bg-surface-container-low border border-outline-variant p-space-md rounded flex flex-col gap-1">
                  <span className="font-label-caps text-[10px] font-bold text-on-surface-variant uppercase">AI Reasoning</span>
                  <span className="font-body-sm text-[13px] text-primary">{selectedItem.reason}</span>
                </div>
              )}

              {/* Dual Evidence Comparison Panel */}
              {(selectedItem.evidence?.tender || selectedItem.evidence?.bidder) && (
                <div className="flex flex-col gap-2 mt-1">
                  <div className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px] text-on-surface-variant">compare_arrows</span>
                    <span className="font-label-caps text-[10px] font-bold text-on-surface-variant uppercase">Evidence Comparison</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {/* Tender Side */}
                    <div className="flex flex-col gap-1 bg-surface-container-low border-l-4 border-l-secondary rounded-r p-space-sm">
                      <span className="font-label-caps text-[9px] font-bold text-secondary uppercase">Required (Tender Document)</span>
                      {selectedItem.evidence?.tender?.text ? (
                        <>
                          <div className="font-mono-data-sm text-[11px] text-primary whitespace-pre-wrap leading-relaxed">
                            {selectedItem.evidence.tender.text}
                          </div>
                          {selectedItem.evidence.tender.page && (
                            <span className="font-mono-data-sm text-[9px] text-on-surface-variant mt-auto pt-1 border-t border-outline-variant">Page {selectedItem.evidence.tender.page}</span>
                          )}
                        </>
                      ) : (
                        <span className="font-body-sm text-[11px] text-on-surface-variant italic">No tender clause text extracted.</span>
                      )}
                    </div>

                    {/* Bidder Side */}
                    <div className="flex flex-col gap-1 bg-amber-50 border-l-4 border-l-amber-400 rounded-r p-space-sm">
                      <span className="font-label-caps text-[9px] font-bold text-amber-800 uppercase">Extracted (Bidder Submission)</span>
                      {selectedItem.evidence?.bidder ? (
                        <>
                          {/* Structured numeric comparison */}
                          {selectedItem.evidence.bidder.extracted_value !== undefined && (
                            <div className="flex flex-col gap-0.5 mb-1 bg-white/60 rounded p-1 border border-amber-200">
                              <div className="font-mono-data-sm text-[11px] font-bold text-primary">
                                Extracted: {selectedItem.evidence.bidder.extracted_value} {selectedItem.evidence.bidder.unit}
                              </div>
                              <div className="font-mono-data-sm text-[11px] text-on-surface-variant">
                                Required: ≥ {selectedItem.evidence.bidder.required_value} {selectedItem.evidence.bidder.unit}
                              </div>
                            </div>
                          )}
                          {/* DOCUMENT_PRESENT */}
                          {selectedItem.evidence.bidder.document_found !== undefined && (
                            <div className="flex flex-col gap-0.5 mb-1 bg-white/60 rounded p-1 border border-amber-200">
                              <div className="font-mono-data-sm text-[11px] font-bold text-primary">
                                Status: {selectedItem.evidence.bidder.document_found ? "Document Found" : "Document Not Found"}
                              </div>
                            </div>
                          )}
                          {/* LLM semantic result if available */}
                          {selectedItem.evidence.bidder.llm_judgment && (
                            <div className="flex flex-col gap-0.5 mb-1 bg-white/60 rounded p-1 border border-amber-200">
                              <div className="font-mono-data-sm text-[11px] font-bold text-primary">
                                LLM Judgment: {selectedItem.evidence.bidder.llm_judgment}
                              </div>
                              <div className="font-mono-data-sm text-[10px] text-on-surface-variant">
                                Confidence: {(selectedItem.evidence.bidder.llm_confidence * 100).toFixed(0)}% · Threshold: {(selectedItem.evidence.bidder.confidence_threshold * 100).toFixed(0)}%
                              </div>
                              {selectedItem.evidence.bidder.llm_reasoning && (
                                <div className="font-body-sm text-[11px] text-primary mt-1 italic">
                                  "{selectedItem.evidence.bidder.llm_reasoning}"
                                </div>
                              )}
                            </div>
                          )}
                          {/* Raw extracted text */}
                          {selectedItem.evidence.bidder.text && (
                            <div className="font-mono-data-sm text-[11px] text-primary whitespace-pre-wrap leading-relaxed">
                              {selectedItem.evidence.bidder.text}
                            </div>
                          )}
                          {selectedItem.evidence.bidder.page && (
                            <span className="font-mono-data-sm text-[9px] text-amber-800 mt-auto pt-1 border-t border-amber-200">Page {selectedItem.evidence.bidder.page}</span>
                          )}
                        </>
                      ) : (
                        <span className="font-body-sm text-[11px] text-amber-800 italic">No matching text extracted from this bidder's document.</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Officer Decision Box */}
              <div className="bg-surface-container-lowest border border-outline-variant rounded flex flex-col mt-2 overflow-hidden">
                <div className="bg-surface-container-low px-space-md py-2 border-b border-outline-variant">
                  <span className="font-label-caps text-[11px] font-bold text-primary uppercase block">Officer Decision</span>
                  <span className="text-[10px] text-on-surface-variant">Human retains final authority. This decision is logged for audit.</span>
                </div>
                <div className="p-space-md flex flex-col gap-space-md">
                  <textarea
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="State your reason for accepting or rejecting this finding..."
                    className="w-full bg-surface-bright border border-outline-variant rounded p-space-sm font-body-sm text-[13px] text-primary focus:outline-none focus:border-secondary resize-y h-24"
                  />
                  <div className="grid grid-cols-2 gap-space-sm">
                    <button
                      onClick={() => handleDecision('COMPLIANT')}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[12px] py-2 rounded flex items-center justify-center gap-1 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">check_box</span> Accept (Compliant)
                    </button>
                    <button
                      onClick={() => handleDecision('NON_COMPLIANT')}
                      className="bg-error/80 hover:bg-error text-white font-bold text-[12px] py-2 rounded flex items-center justify-center gap-1 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">disabled_by_default</span> Override / Reject
                    </button>
                  </div>

                  {/* Session Decision Log */}
                  {overrideLog.length > 0 && (
                    <div className="mt-1 border-t border-outline-variant pt-3">
                      <div className="font-label-caps text-[10px] font-bold text-on-surface-variant uppercase mb-2 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">history</span> Session Decision Log
                      </div>
                      <div className="flex flex-col max-h-[160px] overflow-y-auto">
                        {overrideLog.map((entry, i) => (
                          <div key={i} className="text-[11px] border-b border-outline-variant py-1.5 flex flex-col gap-0.5">
                            <div className="flex justify-between">
                              <span className="font-bold text-primary">{entry.reqId}</span>
                              <span className="text-on-surface-variant font-mono-data-sm">{entry.timestamp}</span>
                            </div>
                            <div>
                              <span className={entry.verdict === 'COMPLIANT' ? 'text-emerald-700 font-bold' : 'text-error font-bold'}>
                                → {entry.verdict}
                              </span>
                              <span className="text-on-surface-variant ml-2 italic">{entry.reason}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-on-surface-variant font-body-sm text-[13px]">
              Select a requirement to view details.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
