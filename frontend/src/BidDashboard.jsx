import React, { useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Flag, ArrowRight, FileText, ShieldCheck, Settings, Globe, CheckSquare, XSquare } from 'lucide-react';

const mockData = {
  "bid_id": "GEM/2026/B/7805877",
  "bidder_name": "ABC Filters Pvt Ltd",
  "summary": { "compliant": 6, "non_compliant": 6, "inconclusive": 5, "total": 17 },
  "compliance_score": 33.3,
  "risk_level": "High",
  "mandatory_hard_fail": true,
  "failed_mandatory_requirements": ["REQ-003", "REQ-004", "POLICY-001", "POLICY-002"],
  "recommendation": "Non-compliant — 6 requirement(s) failed. Recommend rejection pending review.",
  "human_override_applicable": true,
  "line_items": [
    {
      "requirement_id": "REQ-001",
      "verdict": "COMPLIANT",
      "reason": "Bidder's turnover (41.5 lakh) meets required minimum (35 lakh).",
      "evidence": { "tender": { "page": 1, "text": "Minimum Average Annual Turnover..." }, "bidder": { "page": 1, "text": "Average Annual Turnover..." } }
    },
    {
      "requirement_id": "REQ-002",
      "verdict": "INCONCLUSIVE",
      "review_reason": "No quantified figure found for oem_avg_annual_turnover.",
      "requires_human_review": true
    },
    {
      "requirement_id": "REQ-003",
      "verdict": "NON_COMPLIANT",
      "reason": "Required document 'OEM Authorization Certificate' was not found.",
      "review_reason": "Keyword search found no match, confirm manually.",
      "requires_human_review": true
    },
    {
      "requirement_id": "REQ-004",
      "verdict": "NON_COMPLIANT",
      "reason": "Required document 'Bidder Turnover Document' was not found.",
      "review_reason": "Keyword search found no match, confirm manually.",
      "requires_human_review": true
    },
    {
      "requirement_id": "REQ-005",
      "verdict": "INCONCLUSIVE",
      "review_reason": "LLM extraction found insufficient specific evidence to confirm or deny compliance.",
      "requires_human_review": true
    },
    { "requirement_id": "TS-Dedicated_3D/4D", "verdict": "COMPLIANT" },
    { "requirement_id": "TS-Gel_Warmer", "verdict": "INCONCLUSIVE", "review_reason": "Bidder offered 'Yes' when 'No' was required.", "requires_human_review": true },
    { "requirement_id": "TS-Depth,_cm", "verdict": "INCONCLUSIVE", "review_reason": "Tender's stated requirement contains ambiguous unit formats.", "requires_human_review": true },
    { "requirement_id": "TS-Transducer_Ports", "verdict": "COMPLIANT" },
    { "requirement_id": "TS-Touch_Screen", "verdict": "NON_COMPLIANT" },
    { "requirement_id": "TS-Battery_Backup", "verdict": "COMPLIANT" },
    { "requirement_id": "TS-Monitor_Size", "verdict": "COMPLIANT" },
    { "requirement_id": "TS-Weight", "verdict": "COMPLIANT" },
    { "requirement_id": "TS-DICOM", "verdict": "COMPLIANT" },
    { "requirement_id": "TS-Elastography", "verdict": "NON_COMPLIANT" },
    { "requirement_id": "POLICY-001", "verdict": "NON_COMPLIANT", "reason": "Local content 10.0% does not meet minimum (50%)." },
    { "requirement_id": "POLICY-002", "verdict": "NON_COMPLIANT", "reason": "No valid Udyam registration found." }
  ],
  "portal_checks": [
    {
      "check_id": "PAN_CHECKSUM",
      "label": "PAN Structural Validation",
      "status": "VERIFIED",
      "detail": "PAN 'AABCP1234C' passes all structural rules: format, entity-type 'C' (Company), and name-initial check.",
      "is_live": true,
      "evidence": "AABCP1234C"
    },
    {
      "check_id": "GSTIN_FORMAT",
      "label": "GSTIN Format Check (Mocked)",
      "status": "MOCKED",
      "detail": "GSTIN '29AABCP1234C1Z5' passes local format validation. Live portal call not executed. [MOCKED]",
      "is_live": false,
      "evidence": "29AABCP1234C1Z5"
    },
    {
      "check_id": "UDYAM_REGISTRATION",
      "label": "Udyam Registration Check (Mocked)",
      "status": "UNVERIFIED",
      "detail": "No Udyam registration number found in the document.",
      "is_live": false,
      "evidence": null
    }
  ]
};

const getVerdictStyles = (verdict) => {
  switch (verdict) {
    case 'COMPLIANT': return { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200', icon: <CheckCircle className="w-4 h-4 text-green-600" /> };
    case 'NON_COMPLIANT': return { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200', icon: <XCircle className="w-4 h-4 text-red-600" /> };
    case 'INCONCLUSIVE': return { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200', icon: <AlertTriangle className="w-4 h-4 text-yellow-600" /> };
    default: return { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200', icon: null };
  }
};

const getPortalStatusStyles = (status) => {
  switch (status) {
    case 'VERIFIED':   return { dot: 'bg-green-500', badge: 'bg-green-100 text-green-800 border-green-200' };
    case 'FAILED':     return { dot: 'bg-red-500',   badge: 'bg-red-100 text-red-800 border-red-200' };
    case 'MOCKED':     return { dot: 'bg-blue-400',  badge: 'bg-blue-50 text-blue-800 border-blue-200' };
    case 'UNVERIFIED': return { dot: 'bg-gray-400',  badge: 'bg-gray-100 text-gray-600 border-gray-200' };
    default:           return { dot: 'bg-gray-300',  badge: 'bg-gray-100 text-gray-500 border-gray-200' };
  }
};

const PORTAL_CHECK_SHORT = {
  PAN_CHECKSUM:       'PAN',
  GSTIN_FORMAT:       'GSTN',
  UDYAM_REGISTRATION: 'Udyam',
};

const getRiskColor = (level) => {
  if (level === 'Low') return 'bg-green-100 text-green-800 border-green-200';
  if (level === 'Medium') return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  return 'bg-red-100 text-red-800 border-red-200';
};

export default function BidDashboard({ data, bidderName }) {
  const report = data || mockData;
  const [selectedItemId, setSelectedItemId] = useState(report.line_items[0]?.requirement_id);
  const selectedItem = report.line_items.find(item => item.requirement_id === selectedItemId);

  // Human override state: {reqId -> {decision: 'ACCEPTED'|'REJECTED', reason: string}}
  const [overrides, setOverrides] = useState({});
  const [overrideInput, setOverrideInput] = useState('');
  const [overrideLog, setOverrideLog] = useState([]);

  const applyOverride = (reqId, decision) => {
    if (!overrideInput.trim()) return;
    const entry = { reqId, decision, reason: overrideInput.trim(), timestamp: new Date().toLocaleTimeString() };
    setOverrides(prev => ({ ...prev, [reqId]: entry }));
    setOverrideLog(prev => [entry, ...prev]);
    setOverrideInput('');
  };

  // Derived Summary logic for Panel B
  const categories = {
    documents: { total: 0, passed: 0 },
    eligibility: { total: 0, passed: 0 },
    technical: { total: 0, passed: 0 }
  };

  report.line_items.forEach(item => {
    let cat = 'eligibility';
    if (item.requirement_id.startsWith('TS-')) cat = 'technical';
    else if (item.requirement_id === 'REQ-003' || item.requirement_id === 'REQ-004') cat = 'documents';
    
    categories[cat].total++;
    if (item.verdict === 'COMPLIANT') categories[cat].passed++;
  });

  const summaryCount = {
    compliant: report.line_items.filter(i => i.verdict === 'COMPLIANT').length,
    non_compliant: report.line_items.filter(i => i.verdict === 'NON_COMPLIANT').length,
    inconclusive: report.line_items.filter(i => i.verdict === 'INCONCLUSIVE').length,
  };

  // Action Queue: items needing review, sorted mandatory-first
  const CRIT_ORDER = { mandatory: 0, scored: 1 };
  const pendingActions = report.line_items
    .filter(item =>
      item.requires_human_review ||
      item.verdict === 'INCONCLUSIVE' ||
      (item.verdict === 'NON_COMPLIANT' && item.review_reason)
    )
    .sort((a, b) => {
      const ca = CRIT_ORDER[a.criticality ?? 'scored'] ?? 1;
      const cb = CRIT_ORDER[b.criticality ?? 'scored'] ?? 1;
      return ca - cb;
    });

  const displayBidderName = bidderName || report.bidder_name;

  return (
    <div className="flex flex-col h-screen bg-gray-100 text-sm text-gray-900 font-sans overflow-hidden">
      
      {/* PANEL A: Score + Risk Header */}
      <div className="bg-white border-b border-gray-200 p-4 shrink-0 shadow-sm z-10 flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-6">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                Bid ID
              </span>
              <h1 className="text-xl font-bold text-gray-900 font-mono">
                {report.bid_id}
              </h1>
              <p className="text-gray-600 font-medium text-sm">{displayBidderName}</p>
            </div>
            <div className="h-10 w-px bg-gray-300 mx-2"></div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Compliance Score</span>
              <span className="text-2xl font-black text-gray-800">{report.compliance_score} <span className="text-base font-medium text-gray-500">/ 100</span></span>
            </div>
            <div className={`ml-4 px-3 py-1.5 rounded-md border font-bold text-sm uppercase flex items-center gap-1.5 ${getRiskColor(report.risk_level)}`}>
              <ShieldCheck className="w-4 h-4" />
              {report.risk_level} Risk
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <span className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1">
              <Globe className="w-3.5 h-3.5" /> External Verification
            </span>
            {report.portal_checks && report.portal_checks.length > 0 ? (
              <div className="flex gap-1.5 flex-wrap justify-end">
                {report.portal_checks.map(pc => {
                  const s = getPortalStatusStyles(pc.status);
                  const shortName = PORTAL_CHECK_SHORT[pc.check_id] || pc.check_id;
                  const evidenceDisplay = pc.evidence
                    ? (pc.evidence.length > 14 ? pc.evidence.slice(0, 12) + '…' : pc.evidence)
                    : '—';
                  return (
                    <div
                      key={pc.check_id}
                      title={pc.detail}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium ${s.badge}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
                      <span className="font-bold">{shortName}</span>
                      <span className="opacity-70">{evidenceDisplay}</span>
                      {!pc.is_live && (
                        <span className="ml-0.5 text-[9px] font-semibold uppercase tracking-wide opacity-60">mock</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <span className="text-sm font-medium text-gray-400 italic">No portal checks executed</span>
            )}
          </div>
        </div>

        {report.mandatory_hard_fail && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-800 p-3 text-sm font-medium flex items-start gap-2 rounded-r-md">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <strong className="block mb-0.5">Mandatory requirement(s) failed: {report.failed_mandatory_requirements.join(', ')}.</strong> 
              Recommend rejection pending officer review.
            </div>
          </div>
        )}
      </div>

      {/* Main 3-Pane Layout */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* PANE 1: Summaries & Queues */}
        <div className="w-[25%] min-w-[300px] border-r border-gray-200 flex flex-col bg-gray-50 overflow-y-auto">
          
          <div className="p-5 flex flex-col gap-6">
            <div className="flex gap-2">
              <div className="flex-1 bg-green-50 border border-green-200 rounded p-3 flex flex-col items-center">
                <span className="text-2xl font-bold text-green-700">{summaryCount.compliant}</span>
                <span className="text-xs font-semibold text-green-800 uppercase">Compliant</span>
              </div>
              <div className="flex-1 bg-red-50 border border-red-200 rounded p-3 flex flex-col items-center">
                <span className="text-2xl font-bold text-red-700">{summaryCount.non_compliant}</span>
                <span className="text-xs font-semibold text-red-800 uppercase">Failed</span>
              </div>
              <div className="flex-1 bg-yellow-50 border border-yellow-200 rounded p-3 flex flex-col items-center">
                <span className="text-2xl font-bold text-yellow-700">{summaryCount.inconclusive}</span>
                <span className="text-xs font-semibold text-yellow-800 uppercase text-center leading-tight mt-1">Review</span>
              </div>
            </div>

            {/* PANEL B: Verification Status Summary */}
            <div className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden">
              <div className="bg-gray-100 px-3 py-2 border-b border-gray-200">
                <h3 className="font-semibold text-gray-700 uppercase text-xs tracking-wider">Verification Summary</h3>
              </div>
              <div className="flex flex-col text-sm">
                <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-600"><FileText className="w-4 h-4" /> Documents</div>
                  <span className="font-mono font-medium">
                    {categories.documents.total === 0
                      ? 'N/A'
                      : `${categories.documents.passed} of ${categories.documents.total} verified`}
                  </span>
                </div>
                <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-600"><ShieldCheck className="w-4 h-4" /> Eligibility checks</div>
                  <span className="font-mono font-medium">{categories.eligibility.passed} of {categories.eligibility.total} passed</span>
                </div>
                <div className="px-3 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-600"><Settings className="w-4 h-4" /> Technical specs</div>
                  <span className="font-mono font-medium">
                    {categories.technical.total === 0
                      ? 'N/A'
                      : `${categories.technical.passed} of ${categories.technical.total} passed`}
                  </span>
                </div>
              </div>
            </div>

            {/* PANEL C: Pending Requirements Queue */}
            <div className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden flex flex-col flex-1">
              <div className="bg-orange-50 px-3 py-2 border-b border-orange-100 flex justify-between items-center">
                <h3 className="font-semibold text-orange-900 uppercase text-xs tracking-wider flex items-center gap-2">
                  <Flag className="w-4 h-4 text-orange-600" />
                  Action Queue
                </h3>
                <span className="text-xs font-bold text-orange-700 bg-orange-200 px-1.5 py-0.5 rounded">{pendingActions.length} Pending</span>
              </div>
              <div className="flex flex-col overflow-y-auto max-h-[300px]">
                {pendingActions.map(action => {
                  const hasOverride = !!overrides[action.requirement_id];
                  const ov = overrides[action.requirement_id];
                  return (
                    <div
                      key={action.requirement_id}
                      onClick={() => setSelectedItemId(action.requirement_id)}
                      className={`px-3 py-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer flex flex-col gap-1 transition-colors ${hasOverride ? 'opacity-60' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-gray-800">Verify: {action.requirement_id}</span>
                        <div className="flex items-center gap-1">
                          {action.criticality === 'mandatory' && (
                            <span className="text-[9px] font-bold uppercase text-orange-600 bg-orange-50 border border-orange-200 px-1 py-0.5 rounded">MAN</span>
                          )}
                          {hasOverride && (
                            <span className={`text-[9px] font-bold uppercase px-1 py-0.5 rounded border ${
                              ov.decision === 'ACCEPTED' ? 'text-green-700 bg-green-50 border-green-200' : 'text-red-700 bg-red-50 border-red-200'
                            }`}>{ov.decision}</span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-gray-600 leading-snug line-clamp-2">
                        {action.review_reason || action.reason || "Manual confirmation required."}
                      </span>
                    </div>
                  );
                })}
                {pendingActions.length === 0 && (
                  <div className="p-4 text-center text-gray-500 text-xs">No pending actions.</div>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* PANE 2: Clause/Requirement List */}
        <div className="w-[35%] min-w-[350px] border-r border-gray-200 flex flex-col bg-white">
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center shrink-0">
            <h2 className="font-semibold text-gray-800">Evaluated Requirements</h2>
            <span className="text-xs text-gray-500 font-medium">{report.summary.total} Items</span>
          </div>
          
          <div className="overflow-y-auto flex-1">
            {report.line_items.map((item) => {
              const isSelected = item.requirement_id === selectedItemId;
              const styles = getVerdictStyles(item.verdict);
              
              return (
                <div 
                  key={item.requirement_id}
                  onClick={() => setSelectedItemId(item.requirement_id)}
                  className={`p-4 border-b border-gray-100 cursor-pointer transition-colors flex items-center justify-between group
                    ${isSelected ? 'bg-blue-50 border-l-4 border-l-blue-600' : 'hover:bg-gray-50 border-l-4 border-l-transparent'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`px-2.5 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${styles.bg} ${styles.text} ${styles.border}`}>
                      {styles.icon}
                      {item.verdict}
                    </div>
                    <span className={`font-mono text-sm ${isSelected ? 'text-blue-900 font-semibold' : 'text-gray-700 group-hover:text-gray-900'}`}>
                      {item.requirement_id}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {item.requires_human_review && (
                      <Flag className="w-4 h-4 text-orange-500" title="Requires Human Review" />
                    )}
                    <ArrowRight className={`w-4 h-4 ${isSelected ? 'text-blue-600' : 'text-gray-300 group-hover:text-gray-400'}`} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* PANE 3: Evidence Inspector */}
        <div className="w-[40%] min-w-[400px] flex flex-col bg-white overflow-y-auto">
          {!selectedItem ? (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <p>Select a requirement to view details</p>
            </div>
          ) : (
            <div className="p-6 flex flex-col gap-6">
              <div className="flex justify-between items-start border-b border-gray-200 pb-4">
                <div>
                  <h2 className="text-xl font-bold font-mono text-gray-900 mb-2">{selectedItem.requirement_id}</h2>
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-sm font-bold border ${getVerdictStyles(selectedItem.verdict).bg} ${getVerdictStyles(selectedItem.verdict).text} ${getVerdictStyles(selectedItem.verdict).border}`}>
                    {getVerdictStyles(selectedItem.verdict).icon}
                    {selectedItem.verdict}
                  </div>
                </div>
                {selectedItem.requires_human_review && (
                  <div className="flex items-center gap-2 bg-orange-50 text-orange-800 border border-orange-200 px-3 py-1.5 rounded-md text-sm font-semibold shadow-sm">
                    <Flag className="w-4 h-4" />
                    Requires Review
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-4">
                {selectedItem.reason && (
                  <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Automated Reasoning</h3>
                    <p className="text-gray-800">{selectedItem.reason}</p>
                  </div>
                )}

                {selectedItem.review_reason && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                    <h3 className="text-xs font-bold text-yellow-800 uppercase tracking-wider mb-2 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Review Flag Details
                    </h3>
                    <p className="text-yellow-900">{selectedItem.review_reason}</p>
                  </div>
                )}

                {/* Human Override Panel */}
                {(selectedItem.requires_human_review || selectedItem.verdict === 'INCONCLUSIVE' || (selectedItem.verdict === 'NON_COMPLIANT' && selectedItem.review_reason)) && (
                  <div className="border border-gray-200 rounded-md overflow-hidden">
                    <div className="bg-gray-50 border-b border-gray-200 px-4 py-2">
                      <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Officer Decision</h3>
                      <p className="text-[10px] text-gray-500 mt-0.5">Human retains final authority. This decision is logged for audit.</p>
                    </div>
                    <div className="p-4 flex flex-col gap-3">
                      {overrides[selectedItem.requirement_id] ? (
                        <div className={`flex items-start gap-2 p-3 rounded-md border text-sm ${
                          overrides[selectedItem.requirement_id].decision === 'ACCEPTED'
                            ? 'bg-green-50 border-green-200 text-green-900'
                            : 'bg-red-50 border-red-200 text-red-900'
                        }`}>
                          {overrides[selectedItem.requirement_id].decision === 'ACCEPTED'
                            ? <CheckSquare className="w-4 h-4 shrink-0 mt-0.5" />
                            : <XSquare className="w-4 h-4 shrink-0 mt-0.5" />}
                          <div>
                            <p className="font-bold">{overrides[selectedItem.requirement_id].decision}</p>
                            <p className="text-xs mt-0.5 opacity-80">{overrides[selectedItem.requirement_id].reason}</p>
                            <p className="text-[10px] mt-1 opacity-60">{overrides[selectedItem.requirement_id].timestamp}</p>
                          </div>
                        </div>
                      ) : (
                        <>
                          <textarea
                            value={overrideInput}
                            onChange={e => setOverrideInput(e.target.value)}
                            placeholder="State your reason for accepting or rejecting this finding..."
                            className="w-full border border-gray-200 rounded-md px-3 py-2 text-xs text-gray-800 resize-none h-20 focus:outline-none focus:ring-2 focus:ring-blue-300"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => applyOverride(selectedItem.requirement_id, 'ACCEPTED')}
                              disabled={!overrideInput.trim()}
                              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                              <CheckSquare className="w-3.5 h-3.5" /> Accept Finding
                            </button>
                            <button
                              onClick={() => applyOverride(selectedItem.requirement_id, 'REJECTED')}
                              disabled={!overrideInput.trim()}
                              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                              <XSquare className="w-3.5 h-3.5" /> Override / Reject
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Override Audit Log */}
                {overrideLog.length > 0 && (
                  <div className="border border-gray-200 rounded-md overflow-hidden">
                    <div className="bg-gray-50 border-b border-gray-200 px-4 py-2">
                      <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Officer Decision Log</h3>
                    </div>
                    <div className="divide-y divide-gray-100 max-h-48 overflow-y-auto">
                      {overrideLog.map((entry, i) => (
                        <div key={i} className="px-4 py-2 flex items-start gap-2 text-xs">
                          <span className={`font-bold shrink-0 ${
                            entry.decision === 'ACCEPTED' ? 'text-green-700' : 'text-red-700'
                          }`}>{entry.decision}</span>
                          <span className="font-mono text-gray-500 shrink-0">{entry.reqId}</span>
                          <span className="text-gray-700 flex-1">{entry.reason}</span>
                          <span className="text-gray-400 shrink-0">{entry.timestamp}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {selectedItem.evidence && (
                <div className="mt-2">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Extracted Evidence</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="border border-gray-200 rounded-md overflow-hidden flex flex-col">
                      <div className="bg-blue-50 border-b border-gray-200 px-3 py-2 flex justify-between items-center">
                        <span className="font-semibold text-blue-900 text-[10px] uppercase tracking-wide">Tender Document</span>
                        {selectedItem.evidence.tender?.page && (
                          <span className="text-blue-700 text-[10px] font-medium bg-blue-100 px-1.5 py-0.5 rounded">Page {selectedItem.evidence.tender.page}</span>
                        )}
                      </div>
                      <div className="p-4 bg-white text-gray-800 font-mono text-xs whitespace-pre-wrap leading-relaxed break-words h-full">
                        {selectedItem.evidence.tender?.text || <span className="text-gray-400 italic">No tender text extracted</span>}
                      </div>
                    </div>

                    <div className="border border-gray-200 rounded-md overflow-hidden flex flex-col">
                      <div className="bg-indigo-50 border-b border-gray-200 px-3 py-2 flex justify-between items-center">
                        <span className="font-semibold text-indigo-900 text-[10px] uppercase tracking-wide">Bidder Document</span>
                        {selectedItem.evidence.bidder?.page && (
                          <span className="text-indigo-700 text-[10px] font-medium bg-indigo-100 px-1.5 py-0.5 rounded">Page {selectedItem.evidence.bidder.page}</span>
                        )}
                      </div>
                      <div className="p-4 bg-white text-gray-800 font-mono text-xs whitespace-pre-wrap leading-relaxed break-words h-full">
                        {selectedItem.evidence.bidder?.text || <span className="text-gray-400 italic">No bidder text extracted</span>}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
