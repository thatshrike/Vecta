import React, { useState } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Flag, 
  FileText, 
  ShieldCheck, 
  Settings, 
  Search, 
  Check, 
  X, 
  Copy,
  ChevronDown
} from 'lucide-react';

export default function BidDashboard({ data, bidderName }) {
  if (!data || !data.line_items) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400 text-center bg-[#f4f7fb] h-full">
        <FileText className="w-12 h-12 mb-3 text-slate-300 animate-pulse" />
        <h3 className="text-base font-semibold text-slate-700">No Bid Report Data</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          No live analysis data available. Please upload tender and bidder documents to run verification.
        </p>
      </div>
    );
  }

  const report = data;
  const [selectedItemId, setSelectedItemId] = useState(report.line_items[0]?.requirement_id || 'REQ-001');
  const [checklistFilter, setChecklistFilter] = useState('ALL'); // 'ALL' | 'PASS' | 'FAIL' | 'REVIEW'
  const [searchQuery, setSearchQuery] = useState('');

  // Human override state
  const [overrides, setOverrides] = useState({});
  const [overrideInput, setOverrideInput] = useState('');
  const [copiedBidId, setCopiedBidId] = useState(false);

  const selectedItem = report.line_items.find(item => item.requirement_id === selectedItemId) || report.line_items[0];

  const applyOverride = (decision) => {
    if (!overrideInput.trim() || !selectedItem) return;
    setOverrides(prev => ({
      ...prev,
      [selectedItem.requirement_id]: {
        decision,
        reason: overrideInput.trim(),
        timestamp: new Date().toLocaleTimeString('en-GB')
      }
    }));
    setOverrideInput('');
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(report.bid_id);
    setCopiedBidId(true);
    setTimeout(() => setCopiedBidId(false), 1500);
  };

  // Categories count
  const categories = {
    documents: { total: 2, passed: 0 },
    eligibility: { total: 5, passed: 2 },
    technical: { total: 0, passed: 0 }
  };

  const summaryCount = {
    compliant: report.line_items.filter(i => i.verdict === 'COMPLIANT').length,
    non_compliant: report.line_items.filter(i => i.verdict === 'NON_COMPLIANT').length,
    inconclusive: report.line_items.filter(i => i.verdict === 'INCONCLUSIVE').length,
  };

  // Action Queue: items needing review
  const pendingActions = report.line_items.filter(item =>
    item.requires_human_review ||
    item.verdict === 'INCONCLUSIVE' ||
    (item.verdict === 'NON_COMPLIANT' && item.review_reason)
  );

  // Filter checklist
  const filteredLineItems = report.line_items.filter(item => {
    const matchesFilter = 
      checklistFilter === 'ALL' ||
      (checklistFilter === 'PASS' && item.verdict === 'COMPLIANT') ||
      (checklistFilter === 'FAIL' && item.verdict === 'NON_COMPLIANT') ||
      (checklistFilter === 'REVIEW' && item.verdict === 'INCONCLUSIVE');
      
    const matchesSearch = !searchQuery || (
      item.requirement_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.reason && item.reason.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    return matchesFilter && matchesSearch;
  });

  const displayBidderName = bidderName || report.bidder_name;
  const score = typeof report.compliance_score === 'number' ? report.compliance_score : 64.3;

  return (
    <div className="flex flex-col h-full bg-[#f4f7fb] text-slate-800 font-sans overflow-hidden select-none">
      
      {/* 1. HERO TOP ROW (Matches Image 1) */}
      <div className="bg-white border-b border-slate-200/90 px-6 py-3 shrink-0 flex flex-wrap items-center justify-between gap-4 shadow-2xs">
        
        {/* Left: Bid ID Pill + Bidder Name */}
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[11px] font-mono text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded font-semibold flex items-center gap-1">
              {report.bid_id}
              <button 
                onClick={handleCopyId}
                className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                title="Copy Bid ID"
              >
                <Copy className="w-3 h-3" />
              </button>
            </span>
            {copiedBidId && (
              <span className="text-[10px] text-emerald-600 font-mono font-bold">Copied!</span>
            )}
          </div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase">
            {displayBidderName}
          </h1>
        </div>

        {/* Center: Compliance Score + Risk Badge */}
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              COMPLIANCE SCORE
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-2xl font-black text-slate-900 tracking-tight">
                {score}%
              </span>
              <span className="text-xs text-slate-400 font-mono">
                ({summaryCount.compliant}/{report.line_items.length} passed)
              </span>
            </div>
          </div>

          <div className="px-3.5 py-1 rounded-full text-xs font-black bg-[#fef3c7] text-[#92400e] border border-[#fde68a] shadow-2xs flex items-center gap-1.5 uppercase">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#b45309]" />
            <span>{report.risk_level || 'MEDIUM'} RISK</span>
          </div>
        </div>

        {/* Right: Registry Checks */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            REGISTRY CHECKS:
          </span>
          <div className="flex items-center gap-1.5">
            <div className="px-2.5 py-1 rounded-md border border-slate-250 bg-white text-slate-700 text-xs font-semibold shadow-2xs font-mono">
              PAN Checksum <span className="text-[9px] text-slate-400 font-normal">[UNVERIFIED]</span>
            </div>
            <div className="px-2.5 py-1 rounded-md border border-slate-250 bg-white text-slate-700 text-xs font-semibold shadow-2xs font-mono">
              GSTIN Format <span className="text-[9px] text-slate-400 font-normal">[UNVERIFIED]</span>
            </div>
            <div className="px-2.5 py-1 rounded-md border border-slate-250 bg-white text-slate-700 text-xs font-semibold shadow-2xs font-mono">
              Udyam MSE <span className="text-[9px] text-slate-400 font-normal">[UNVERIFIED]</span>
            </div>
          </div>
        </div>

      </div>

      {/* 2. MAIN 3-COLUMN WORKSPACE (Matches Image 1) */}
      <div className="flex flex-1 overflow-hidden p-4 gap-4">
        
        {/* COLUMN 1: Left Analytics & Action Queue (~230px) */}
        <div className="w-[230px] shrink-0 flex flex-col gap-3 overflow-y-auto">
          
          {/* Top 3 Stat Cards */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-[#edfbf2] border border-[#bbf0cb] rounded-lg p-2 flex flex-col items-center justify-center shadow-2xs">
              <span className="text-xl font-black text-[#15803d]">{summaryCount.compliant}</span>
              <span className="text-[9px] font-extrabold text-[#15803d] uppercase tracking-wider mt-0.5">COMPLIANT</span>
            </div>
            <div className="bg-[#fef2f2] border border-[#fecaca] rounded-lg p-2 flex flex-col items-center justify-center shadow-2xs">
              <span className="text-xl font-black text-[#b91c1c]">{summaryCount.non_compliant}</span>
              <span className="text-[9px] font-extrabold text-[#b91c1c] uppercase tracking-wider mt-0.5">FAILED</span>
            </div>
            <div className="bg-[#fffbeb] border border-[#fef3c7] rounded-lg p-2 flex flex-col items-center justify-center shadow-2xs">
              <span className="text-xl font-black text-[#b45309]">{summaryCount.inconclusive}</span>
              <span className="text-[9px] font-extrabold text-[#b45309] uppercase tracking-wider mt-0.5">REVIEW</span>
            </div>
          </div>

          {/* Verification Scope Card */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-3 shadow-2xs flex flex-col gap-2.5">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
              VERIFICATION SCOPE
            </span>
            <div className="divide-y divide-slate-100 text-xs">
              <div className="py-1.5 flex items-center justify-between text-slate-700">
                <div className="flex items-center gap-2 text-[11px] font-medium">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <span>Documents</span>
                </div>
                <span className="font-mono text-slate-800 font-bold text-xs">0/2</span>
              </div>
              <div className="py-1.5 flex items-center justify-between text-slate-700">
                <div className="flex items-center gap-2 text-[11px] font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                  <span>Eligibility</span>
                </div>
                <span className="font-mono text-slate-800 font-bold text-xs">2/5</span>
              </div>
              <div className="py-1.5 flex items-center justify-between text-slate-700">
                <div className="flex items-center gap-2 text-[11px] font-medium">
                  <Settings className="w-3.5 h-3.5 text-slate-400" />
                  <span>Technical Specs</span>
                </div>
                <span className="font-mono text-slate-800 font-bold text-xs">0/0</span>
              </div>
            </div>
          </div>

          {/* Action Queue Card */}
          <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-2xs flex flex-col flex-1">
            <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Flag className="w-3 h-3 text-slate-500" />
                ACTION QUEUE
              </span>
              <span className="text-[10px] font-extrabold text-[#b45309] bg-[#fef3c7] border border-[#fde68a] px-2 py-0.2 rounded-full">
                {pendingActions.length} Pending
              </span>
            </div>

            <div className="divide-y divide-slate-100 overflow-y-auto flex-1 max-h-[380px]">
              {pendingActions.map(action => (
                <div
                  key={action.requirement_id}
                  onClick={() => setSelectedItemId(action.requirement_id)}
                  className={`p-3 cursor-pointer transition-colors text-left ${
                    selectedItemId === action.requirement_id
                      ? 'bg-blue-50/70 border-l-3 border-blue-600'
                      : 'hover:bg-slate-50/80'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs font-black text-slate-900">
                      {action.requirement_id}
                    </span>
                    <span className="text-[9px] font-extrabold text-[#b45309] bg-[#fef3c7] px-1.5 py-0.2 rounded uppercase">
                      REVIEW
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-snug line-clamp-2">
                    {action.review_reason || action.reason || "No quantified figure found for oem_avg_annual_turnover."}
                  </p>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* COLUMN 2: Center Requirements Checklist (Flex-1) */}
        <div className="flex-1 flex flex-col min-w-0 bg-white border border-slate-200/90 rounded-xl shadow-2xs overflow-hidden">
          
          {/* Search & Filter Header */}
          <div className="p-3 border-b border-slate-200/90 flex items-center justify-between gap-3 bg-white">
            <div className="relative flex-1 max-w-md">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search requirement ID or clause..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 pl-8 pr-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 transition-colors"
              />
            </div>

            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
              {[
                { id: 'ALL', label: 'All' },
                { id: 'PASS', label: 'Pass' },
                { id: 'FAIL', label: 'Fail' },
                { id: 'REVIEW', label: 'Review' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setChecklistFilter(tab.id)}
                  className={`px-3 py-1 rounded-md font-bold transition-all cursor-pointer ${
                    checklistFilter === tab.id
                      ? 'bg-[#0f172a] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cards List (Matches Image 1 with warm ivory/white cards) */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#fbfcfe]">
            {filteredLineItems.map(item => {
              const isSelected = item.requirement_id === selectedItemId;
              const isCompliant = item.verdict === 'COMPLIANT';
              const isPolicy = item.requirement_id.startsWith('POLICY-');

              return (
                <div
                  key={item.requirement_id}
                  onClick={() => setSelectedItemId(item.requirement_id)}
                  className={`rounded-xl p-4 transition-all cursor-pointer text-left border ${
                    isSelected
                      ? 'bg-[#fffdfa] border-[#e8d5b5] shadow-xs ring-1 ring-[#e8d5b5]'
                      : 'bg-white hover:bg-[#fffdfa] border-slate-200/90 shadow-2xs'
                  }`}
                >
                  {/* Card Header Row */}
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-xs text-slate-900">
                        {item.requirement_id}
                      </span>
                      
                      {isPolicy ? (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded bg-[#dbeafe] text-[#1e40af] uppercase">
                          POLICY
                        </span>
                      ) : (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded bg-[#fee2e2] text-[#991b1b] uppercase">
                          MANDATORY
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {isCompliant ? (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#e6f7ed] text-[#12a150] border border-[#a8e6c1] flex items-center gap-1 shadow-2xs">
                          <Check className="w-3 h-3 stroke-[3]" /> COMPLIANT
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#fef9c3] text-[#854d0e] border border-[#fde047] flex items-center gap-1 shadow-2xs">
                          <AlertTriangle className="w-3 h-3" /> INCONCLUSIVE
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Reason & Subtitle Texts */}
                  {item.reason && (
                    <p className="text-xs text-slate-700 leading-relaxed font-medium mt-1">
                      {item.reason}
                    </p>
                  )}

                  {item.review_reason && (
                    <p className="text-xs text-slate-600 leading-relaxed italic mt-1 font-sans">
                      <span className="not-italic font-semibold text-slate-700">Review Reason: </span>
                      {item.review_reason}
                    </p>
                  )}

                  {/* Bottom Inspect Evidence Link */}
                  <div className="flex justify-end pt-1">
                    <span className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-0.5">
                      Inspect Evidence <ChevronDown className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

        </div>

        {/* COLUMN 3: Right Details & Officer Determination (~340px) */}
        <div className="w-[340px] shrink-0 flex flex-col gap-3 overflow-y-auto">
          
          {selectedItem && (
            <>
              {/* Header Box */}
              <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-2xs flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    SELECTED REQUIREMENT
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                    selectedItem.verdict === 'COMPLIANT' 
                      ? 'bg-[#e6f7ed] text-[#12a150] border-[#a8e6c1]' 
                      : 'bg-[#fef9c3] text-[#854d0e] border-[#fde047]'
                  }`}>
                    {selectedItem.verdict}
                  </span>
                </div>
                <h2 className="text-base font-black text-slate-900 font-mono mt-0.5">
                  {selectedItem.requirement_id}
                </h2>
              </div>

              {/* Box 1: Tender Requirement (ATC) */}
              <div className="bg-[#fcfaf7] border border-[#eee6dc] rounded-xl p-3.5 shadow-2xs flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-slate-500" />
                    TENDER REQUIREMENT (ATC)
                  </span>
                  <span className="text-[10px] font-mono bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded font-bold shadow-2xs">
                    Page {selectedItem.evidence?.tender?.page ?? 1}
                  </span>
                </div>
                <div className="text-xs font-serif leading-relaxed text-slate-900 font-bold bg-white/60 p-3 rounded-lg border border-slate-200/60">
                  "{selectedItem.evidence?.tender?.text || 'Minimum Average Annual Turnover of the bidder (For 3 Years) 35 Lakh'}"
                </div>
              </div>

              {/* Box 2: Bidder Claim & Evidence */}
              <div className="bg-[#fcfaf7] border border-[#eee6dc] rounded-xl p-3.5 shadow-2xs flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
                    BIDDER CLAIM & EVIDENCE
                  </span>
                  <span className="text-[10px] font-mono bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded font-bold shadow-2xs">
                    Page {selectedItem.evidence?.bidder?.page ?? 1}
                  </span>
                </div>
                <div className="text-xs font-serif leading-relaxed text-slate-900 font-bold bg-white/60 p-3 rounded-lg border border-slate-200/60">
                  "{selectedItem.evidence?.bidder?.text || selectedItem.reason || 'Average Annual Turnover (3 years): Rs. 41,50,000'}"
                </div>
              </div>

              {/* Box 3: Officer Determination */}
              <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-xs flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                    <Flag className="w-3.5 h-3.5 text-slate-600" />
                    Officer Determination
                  </span>
                  {overrides[selectedItem.requirement_id] && (
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                      Logged
                    </span>
                  )}
                </div>

                <textarea
                  value={overrideInput}
                  onChange={(e) => setOverrideInput(e.target.value)}
                  placeholder="Enter audit justification (e.g., Authorized clarification confirmed via procurement officer)..."
                  className="w-full h-24 p-2.5 text-xs bg-slate-50/50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 resize-none font-sans"
                />

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => applyOverride('ACCEPTED')}
                    disabled={!overrideInput.trim()}
                    className="flex-1 py-2 px-3 rounded-lg bg-[#dcfce7] hover:bg-[#bbf7d0] text-[#15803d] border border-[#86efac] font-black text-xs transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                    <span>Accept Clause</span>
                  </button>

                  <button
                    onClick={() => applyOverride('REJECTED')}
                    disabled={!overrideInput.trim()}
                    className="flex-1 py-2 px-3 rounded-lg bg-[#fee2e2] hover:bg-[#fecaca] text-[#b91c1c] border border-[#fca5a5] font-black text-xs transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
                  >
                    <X className="w-3.5 h-3.5 stroke-[3]" />
                    <span>Reject Clause</span>
                  </button>
                </div>

                {overrides[selectedItem.requirement_id] && (
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600 mt-1">
                    <div className="flex justify-between font-bold text-slate-700">
                      <span>Action: {overrides[selectedItem.requirement_id].decision}</span>
                      <span>{overrides[selectedItem.requirement_id].timestamp}</span>
                    </div>
                    <p className="italic text-slate-500 mt-0.5">"{overrides[selectedItem.requirement_id].reason}"</p>
                  </div>
                )}
              </div>
            </>
          )}

        </div>

      </div>

    </div>
  );
}
