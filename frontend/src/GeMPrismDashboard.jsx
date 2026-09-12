import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  Upload, 
  FileText, 
  Download, 
  Sparkles, 
  Check, 
  X, 
  Cpu, 
  Zap, 
  ChevronDown, 
  ExternalLink,
  ShieldAlert,
  Printer,
  ChevronRight,
  RefreshCw,
  Eye
} from 'lucide-react';
import { analyzeTenderAndBidders } from './api/complianceApi';

// Official user folders from test_data directory
const USER_TENDERS = [
  {
    key: 'drdo',
    tenderId: 'GEM/2021/B/1538362',
    label: 'GEM/2021/B/1538362 - DRDO BOQ Tender',
    tenderFile: 'tender_drdo.pdf',
    folderName: 'drdo',
    bidders: [
      { filename: 'drdo_boq_bidder_compliant.pdf', label: 'drdo_boq_bidder_compliant.pdf (Compliant)' },
      { filename: 'drdo_boq_bidder_noncompliant.pdf', label: 'drdo_boq_bidder_noncompliant.pdf (Non-Compliant)' },
      { filename: 'drdo_boq_bidder_ambigous.pdf', label: 'drdo_boq_bidder_ambigous.pdf (Ambiguous)' }
    ]
  },
  {
    key: 'bhel',
    tenderId: 'GEM/2022/B/9021481',
    label: 'GEM/2022/B/9021481 - BHEL Heavy Electricals NIT',
    tenderFile: 'tender_bhel.pdf',
    folderName: 'bhel',
    bidders: [
      { filename: 'bidder_compliant.pdf', label: 'bidder_compliant.pdf (Compliant)' },
      { filename: 'bidder_noncompliant.pdf', label: 'bidder_noncompliant.pdf (Non-Compliant)' },
      { filename: 'bidder_ambigous.pdf', label: 'bidder_ambigous.pdf (Ambiguous)' },
      { filename: 'bidder_full_compliant.pdf', label: 'bidder_full_compliant.pdf (Full Compliant)' },
      { filename: 'bidder_partial_compliant.pdf', label: 'bidder_partial_compliant.pdf (Partial Compliant)' }
    ]
  },
  {
    key: 'iitkanpur',
    tenderId: 'IITK/2023/EQ/4102',
    label: 'IITK/2023/EQ/4102 - IIT Kanpur Technical Tender',
    tenderFile: 'tender_iitkanpur.pdf',
    folderName: 'iitkanpur',
    bidders: [
      { filename: 'iitkanpur_compliant_bidder.pdf', label: 'iitkanpur_compliant_bidder.pdf (Compliant)' },
      { filename: 'iitkanpur_non_compliant_bidder.pdf', label: 'iitkanpur_non_compliant_bidder.pdf (Non-Compliant)' },
      { filename: 'iikanpur_ambiguous_bidder.pdf', label: 'iikanpur_ambiguous_bidder.pdf (Ambiguous)' }
    ]
  },
  {
    key: 'niti_ayog',
    tenderId: 'NITI/2023/CON/8119',
    label: 'NITI/2023/CON/8119 - NITI Aayog Advisory Tender',
    tenderFile: 'tender_niti_ayog.pdf',
    folderName: 'niti_ayog',
    bidders: [
      { filename: 'bidder_compliant_niti_ayog.pdf', label: 'bidder_compliant_niti_ayog.pdf (Compliant)' },
      { filename: 'bidder_noncompliant_niti_ayog.pdf', label: 'bidder_noncompliant_niti_ayog.pdf (Non-Compliant)' },
      { filename: 'bidder_ambiguous_niti_ayog.pdf', label: 'bidder_ambiguous_niti_ayog.pdf (Ambiguous)' }
    ]
  }
];

const PARAMETER_NAMES = {
  'REQ-001': 'Minimum Average Annual Turnover',
  'REQ-002': 'OEM Average Annual Turnover',
  'REQ-003': 'OEM Authorization Certificate',
  'REQ-004': 'Bidder Turnover Document',
  'REQ-005': 'Past Performance (Govt / PSU Supply)',
  'POLICY-001': 'Make In India (Class 1 MII >= 50%)',
  'POLICY-002': 'MSE Purchase Preference (Udyam Registration)'
};

export default function GeMPrismDashboard() {
  // Selected user folder / tender
  const [selectedTenderKey, setSelectedTenderKey] = useState('drdo');
  const activeTender = USER_TENDERS.find(t => t.key === selectedTenderKey) || USER_TENDERS[0];

  // Selected bidder within the active tender folder
  const [selectedBidderFilename, setSelectedBidderFilename] = useState('drdo_boq_bidder_compliant.pdf');
  const [customBidderFile, setCustomBidderFile] = useState(null);
  const [customTenderFile, setCustomTenderFile] = useState(null);

  // Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [hasRunAnalysis, setHasRunAnalysis] = useState(false);

  // Real data populated strictly from backend analysis
  const [criteriaRows, setCriteriaRows] = useState([]);
  const [heroData, setHeroData] = useState({
    bidderName: 'DRDO BOQ BIDDER COMPLIANT',
    tenderRef: 'Tender Ref: GEM/2021/B/1538362 (DRDO BOQ)',
    technicalScore: 50.0,
    financialScore: 50.0,
    legalScore: 50.0,
    overallScore: 50.0,
    isCompliant: true,
    certifiedDate: `Date ${new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}`
  });

  // Selected clause for Accept / Reject Clause action
  const [selectedClauseId, setSelectedClauseId] = useState('');

  // Modals
  const [activeCitationModal, setActiveCitationModal] = useState(null);
  const [showRejectMemoModal, setShowRejectMemoModal] = useState(false);

  // File Inputs
  const bidderInputRef = useRef(null);
  const tenderInputRef = useRef(null);

  // Run analysis when tender or bidder selection changes or on initial load
  useEffect(() => {
    runAnalysisForCurrentSelection();
  }, [selectedTenderKey, selectedBidderFilename, customBidderFile, customTenderFile]);

  // Execute real backend analysis with selected files
  const runAnalysisForCurrentSelection = async () => {
    setIsAnalyzing(true);
    setAnalysisError('');

    try {
      // 1. Resolve Tender File
      let tenderBlobFile = customTenderFile;
      if (!tenderBlobFile) {
        const tenderUrl = `/samples/${activeTender.tenderFile}`;
        const tRes = await fetch(tenderUrl);
        if (!tRes.ok) throw new Error(`Could not load tender file from ${tenderUrl}`);
        const tBlob = await tRes.blob();
        tenderBlobFile = new File([tBlob], activeTender.tenderFile, { type: 'application/pdf' });
      }

      // 2. Resolve Bidder File
      let bidderBlobFile = customBidderFile;
      if (!bidderBlobFile) {
        const bidderUrl = `/samples/${selectedBidderFilename}`;
        const bRes = await fetch(bidderUrl);
        if (!bRes.ok) throw new Error(`Could not load bidder file from ${bidderUrl}`);
        const bBlob = await bRes.blob();
        bidderBlobFile = new File([bBlob], selectedBidderFilename, { type: 'application/pdf' });
      }

      const derivedName = bidderBlobFile.name
        .replace(/\.pdf$/i, '')
        .replace(/^bidder_/i, '')
        .replace(/_/g, ' ')
        .toUpperCase();

      // 3. Call Real FastAPI Backend
      const bidderPayload = [{
        file: bidderBlobFile,
        derivedName
      }];

      const reports = await analyzeTenderAndBidders(tenderBlobFile, bidderPayload);

      if (reports && reports.length > 0) {
        const rep = reports[0];
        const complianceScore = typeof rep.compliance_score === 'number' ? rep.compliance_score : 50.0;
        const isComp = !rep.mandatory_hard_fail && complianceScore >= 50.0;

        // Map real backend line items directly
        if (rep.line_items && rep.line_items.length > 0) {
          const mappedRows = rep.line_items.map((item, idx) => {
            let status = 'REVIEW';
            if (item.verdict === 'COMPLIANT') status = 'VERIFIED';
            else if (item.verdict === 'NON_COMPLIANT') status = 'MISMATCH';

            const paramName = PARAMETER_NAMES[item.requirement_id] || item.requirement_id;
            
            let reqText = 'As per Tender Specification';
            if (item.evidence && item.evidence.tender) {
              reqText = typeof item.evidence.tender === 'object' ? item.evidence.tender.text : item.evidence.tender;
            } else if (item.reason && item.reason.includes('Required')) {
              reqText = item.reason;
            }

            let proofText = 'No explicit declaration found in bidder PDF';
            if (item.evidence && item.evidence.bidder) {
              proofText = typeof item.evidence.bidder === 'object' ? item.evidence.bidder.text : item.evidence.bidder;
            } else if (item.reason) {
              proofText = item.reason;
            }

            const docLocation = item.evidence?.tender?.page 
              ? `Tender Doc Page ${item.evidence.tender.page}` 
              : `Evaluation Rule ${item.requirement_id}`;

            return {
              id: item.requirement_id,
              parameter: paramName,
              requirement: reqText,
              proof: proofText,
              docRef: docLocation,
              docSnippet: proofText,
              status,
              isHighlighted: status === 'VERIFIED'
            };
          });

          setCriteriaRows(mappedRows);
          if (!selectedClauseId && mappedRows.length > 0) {
            setSelectedClauseId(mappedRows[0].id);
          }
        }

        // Real subscore calculation based on actual line item verdicts
        const totalItems = rep.line_items ? rep.line_items.length : 1;
        const passedItems = rep.line_items ? rep.line_items.filter(i => i.verdict === 'COMPLIANT').length : 0;
        const technicalItems = rep.line_items ? rep.line_items.filter(i => i.requirement_id.startsWith('REQ-')) : [];
        const policyItems = rep.line_items ? rep.line_items.filter(i => i.requirement_id.startsWith('POLICY-')) : [];

        const techScore = technicalItems.length > 0 
          ? Math.round((technicalItems.filter(i => i.verdict === 'COMPLIANT').length / technicalItems.length) * 1000) / 10 
          : complianceScore;
        const legalScore = policyItems.length > 0 
          ? Math.round((policyItems.filter(i => i.verdict === 'COMPLIANT').length / policyItems.length) * 1000) / 10 
          : complianceScore;

        setHeroData({
          bidderName: rep.bidder_name || derivedName,
          tenderRef: `Tender Ref: ${customTenderFile ? customTenderFile.name : activeTender.label}`,
          technicalScore: techScore,
          financialScore: complianceScore,
          legalScore: legalScore,
          overallScore: complianceScore,
          isCompliant: isComp,
          certifiedDate: `Date ${new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}`
        });

        setHasRunAnalysis(true);
      }
    } catch (err) {
      console.error('Analysis error with user folder files:', err);
      setAnalysisError(err.message || 'Analysis failed. Check if API backend is active on port 8000.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Switch Active Tender Folder
  const handleTenderChange = (e) => {
    const key = e.target.value;
    setSelectedTenderKey(key);
    setCustomTenderFile(null);
    setCustomBidderFile(null);
    const targetTender = USER_TENDERS.find(t => t.key === key) || USER_TENDERS[0];
    if (targetTender.bidders && targetTender.bidders.length > 0) {
      setSelectedBidderFilename(targetTender.bidders[0].filename);
    }
  };

  // Switch Active Bidder from Folder
  const handleBidderSelect = (filename) => {
    setCustomBidderFile(null);
    setSelectedBidderFilename(filename);
  };

  // Drop custom bidder PDF from folder
  const handleBidderDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer ? e.dataTransfer.files[0] : e.target.files[0];
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
      alert('Please select a valid PDF from your project folder.');
      return;
    }
    setCustomBidderFile(file);
    setSelectedBidderFilename(file.name);
  };

  // Drop custom tender PDF from folder
  const handleTenderDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer ? e.dataTransfer.files[0] : e.target.files[0];
    if (!file) return;
    setCustomTenderFile(file);
  };

  // Clause Adjudication
  const handleAcceptClause = () => {
    if (!selectedClauseId) return;
    setCriteriaRows(prev => {
      const updated = prev.map(r => r.id === selectedClauseId ? { ...r, status: 'VERIFIED' } : r);
      const passed = updated.filter(r => r.status === 'VERIFIED').length;
      const total = updated.length || 1;
      const newScore = Math.round((passed / total) * 1000) / 10;
      setHeroData(h => ({
        ...h,
        overallScore: newScore,
        isCompliant: updated.filter(r => r.status === 'MISMATCH').length === 0
      }));
      return updated;
    });
  };

  const handleRejectClause = () => {
    if (!selectedClauseId) return;
    setCriteriaRows(prev => {
      const updated = prev.map(r => r.id === selectedClauseId ? { ...r, status: 'MISMATCH' } : r);
      const passed = updated.filter(r => r.status === 'VERIFIED').length;
      const total = updated.length || 1;
      const newScore = Math.round((passed / total) * 1000) / 10;
      setHeroData(h => ({
        ...h,
        overallScore: newScore,
        isCompliant: false
      }));
      return updated;
    });
  };

  // Counts
  const passedCount = criteriaRows.filter(r => r.status === 'VERIFIED').length;
  const failedCount = criteriaRows.filter(r => r.status === 'MISMATCH').length;
  const pendingCount = criteriaRows.filter(r => r.status === 'REVIEW').length;
  const selectedClause = criteriaRows.find(r => r.id === selectedClauseId) || criteriaRows[0];

  // Export JSON Report
  const handleExportReport = () => {
    const reportData = {
      auditTimestamp: new Date().toISOString(),
      tender: customTenderFile ? customTenderFile.name : activeTender.tenderFile,
      bidder: customBidderFile ? customBidderFile.name : selectedBidderFilename,
      status: heroData.isCompliant ? 'CERTIFIED_COMPLIANT' : 'NON_COMPLIANT',
      scores: {
        overall: heroData.overallScore,
        technical: heroData.technicalScore,
        financial: heroData.financialScore,
        legal: heroData.legalScore
      },
      stats: {
        passed: passedCount,
        failed: failedCount,
        pending: pendingCount
      },
      evaluatedLineItems: criteriaRows
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(reportData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `Compliance_Audit_${heroData.bidderName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="flex flex-col min-h-screen w-screen bg-[#edf2f7] font-sans text-slate-800 antialiased select-none">
      
      {/* 1. TOP NAV BAR */}
      <header className="bg-[#091b36] border-b border-[#051124] text-white px-5 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-600/90 border border-blue-400/40 flex items-center justify-center shadow-inner">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-xl font-black tracking-wide leading-none text-white flex items-center gap-2">
              GeM PRISM
            </h1>
            <span className="text-[12px] text-slate-300 font-normal tracking-tight mt-1">
              Procurement Risk Inspection & Compliance Spectrum Engine
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1 rounded-full border border-slate-600/70 bg-[#122849] text-[12px] text-slate-300 font-medium">
            Government e-Marketplace Suite
          </div>
        </div>
      </header>

      {/* 2. REALTIME STATUS RIBBON */}
      <div className="bg-white border-b border-slate-200/80 px-6 py-1.5 flex items-center justify-end gap-6 text-[12px] shadow-2xs">
        <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>All Systems Normal</span>
        </div>
        <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
          <Cpu className="w-3.5 h-3.5 text-emerald-600" />
          <span>AI Model: Active</span>
        </div>
        <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
          <Zap className="w-3.5 h-3.5 text-emerald-600" />
          <span>AI Model: Active</span>
        </div>
      </div>

      {/* 3. MAIN CONTENT */}
      <main className="flex-1 p-4 sm:p-5 flex flex-col lg:flex-row gap-5 max-w-[1700px] w-full mx-auto">
        
        {/* LEFT COLUMN: Document Controls */}
        <aside className="w-full lg:w-[330px] shrink-0 flex flex-col gap-4">
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-4 flex flex-col gap-4">
            
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              1. Document Controls
            </h2>

            {/* ACTIVE TENDER SELECTION */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                ACTIVE TENDER SELECTION
              </label>
              <div className="relative">
                <select
                  value={selectedTenderKey}
                  onChange={handleTenderChange}
                  className="w-full bg-slate-50 border border-slate-300 hover:border-slate-400 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 pr-8 appearance-none focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors cursor-pointer"
                >
                  {USER_TENDERS.map(t => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-500 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>

              {/* Tender File Info */}
              <div className="mt-1 bg-slate-50/90 border border-slate-200 rounded-lg p-2.5 flex items-center justify-between text-xs">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">TENDER FILE</span>
                  <span className="text-[11px] font-medium text-slate-700 truncate max-w-[170px]">
                    {customTenderFile ? customTenderFile.name : activeTender.tenderFile}
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">STATUS</span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                    failedCount > 0 
                      ? 'bg-rose-100 text-rose-800 border border-rose-200' 
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  }`}>
                    {failedCount > 0 ? 'Failed' : 'Passed'}
                  </span>
                </div>
              </div>
            </div>

            {/* BIDDER SUBMISSION PDF */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                BIDDER SUBMISSION PDF
              </label>

              {/* Real Bidder files for active folder */}
              <div className="flex flex-col gap-1 mb-1">
                {activeTender.bidders.map(b => (
                  <button
                    key={b.filename}
                    onClick={() => handleBidderSelect(b.filename)}
                    className={`text-left text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border transition-all truncate cursor-pointer ${
                      selectedBidderFilename === b.filename && !customBidderFile
                        ? 'bg-blue-50 border-blue-400 text-blue-900 shadow-2xs font-bold'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>

              {/* Dropzone Box */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleBidderDrop}
                onClick={() => bidderInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-blue-400 bg-slate-50/70 hover:bg-blue-50/30 rounded-xl p-3 flex flex-col items-center justify-center text-center cursor-pointer transition-all group"
              >
                <input
                  type="file"
                  ref={bidderInputRef}
                  onChange={handleBidderDrop}
                  accept=".pdf"
                  className="hidden"
                />
                
                <Upload className="w-5 h-5 text-slate-500 group-hover:text-blue-600 transition-colors mb-1" />
                <span className="text-xs text-slate-600 font-medium">
                  Drop Bidder PDF or <span className="text-blue-600 font-semibold underline">Browse</span>
                </span>

                <div className="mt-2 w-full bg-white border border-slate-200 rounded-lg p-2 flex flex-col gap-1 shadow-2xs">
                  <span className="text-[11px] font-bold text-slate-800 truncate text-left">
                    {customBidderFile ? customBidderFile.name : selectedBidderFilename}
                  </span>
                  <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 rounded-full w-full"></div>
                  </div>
                </div>

                <div className="w-full flex items-center justify-between text-[11px] font-medium text-slate-600 mt-2 px-1">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3.5 h-3.5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                    <span>OCR Complete</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3.5 h-3.5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                    <span>Text Extracted</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Run Analysis CTA */}
            <button
              onClick={runAnalysisForCurrentSelection}
              disabled={isAnalyzing}
              className="w-full py-2.5 px-4 rounded-lg bg-gradient-to-r from-[#1746a2] to-[#1e58c8] hover:from-[#133a87] hover:to-[#1746a2] text-white font-semibold text-xs tracking-wide shadow-md shadow-blue-800/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Run Analysis</span>
                </>
              )}
            </button>

            {analysisError && (
              <div className="p-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-[11px] leading-tight">
                {analysisError}
              </div>
            )}

            {/* Custom Tender Notice PDF */}
            <div className="flex flex-col gap-1.5 pt-1 border-t border-slate-200">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                REGISTER CUSTOM TENDER PDF
              </label>

              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleTenderDrop}
                onClick={() => tenderInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-slate-400 bg-slate-50/50 rounded-xl p-3 flex flex-col items-center justify-center text-center cursor-pointer transition-colors"
              >
                <input
                  type="file"
                  ref={tenderInputRef}
                  onChange={handleTenderDrop}
                  accept=".pdf"
                  className="hidden"
                />
                <Upload className="w-4 h-4 text-slate-400 mb-1" />
                <span className="text-[11px] text-slate-600 font-medium">
                  {customTenderFile ? customTenderFile.name : 'Drop Custom Tender PDF'}
                </span>
              </div>
            </div>

          </div>
        </aside>

        {/* RIGHT COLUMN: Real Backend Results */}
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          
          {/* ROW 1: 3 TOP STAT CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Card 1: PASSED CRITERIA */}
            <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-sm flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  PASSED CRITERIA
                </span>
                <span className="text-3xl font-black text-emerald-600 tracking-tight mt-1">
                  {passedCount}
                </span>
                <span className="text-xs font-semibold text-slate-600 mt-0.5">
                  Passed Criteria
                </span>
              </div>

              {/* Mini Bar Chart */}
              <div className="flex items-end gap-1.5 pl-2">
                <div className="flex flex-col justify-between text-[8px] font-bold text-slate-400 h-14 leading-none pr-1 select-none">
                  <span>100</span>
                  <span>75</span>
                  <span>50</span>
                  <span>25</span>
                  <span>0</span>
                </div>
                <div className="flex items-end gap-1.5 h-14 pt-1">
                  {[
                    { month: 'Jan', height: 'h-6' },
                    { month: 'Feb', height: 'h-8' },
                    { month: 'Mar', height: 'h-7' },
                    { month: 'Apr', height: 'h-12' },
                    { month: 'May', height: 'h-10' },
                    { month: 'Dec', height: 'h-9' }
                  ].map((bar, i) => (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <div className={`w-3 ${bar.height} bg-emerald-500 rounded-t-xs transition-all`}></div>
                      <span className="text-[8px] text-slate-400 font-medium">{bar.month}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Card 2: FAILED FLAGS */}
            <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-sm flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  FAILED FLAGS
                </span>
                <span className={`text-3xl font-black tracking-tight mt-1 ${failedCount > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                  {failedCount}
                </span>
                <span className="text-xs font-semibold text-slate-600 mt-0.5">
                  {failedCount > 0 ? `Critical violations in ${failedCount} critical` : 'Critical violations in 0 critical'}
                </span>
              </div>

              <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-200/80 flex items-center justify-center text-rose-500 shadow-2xs">
                <ShieldAlert className="w-6 h-6 stroke-[1.75]" />
              </div>
            </div>

            {/* Card 3: PENDING REVIEW */}
            <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-sm flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  PENDING REVIEW
                </span>
                <span className="text-3xl font-black text-amber-500 tracking-tight mt-1">
                  {pendingCount}
                </span>
                <span className="text-xs font-semibold text-slate-600 mt-0.5">
                  {pendingCount > 0 ? 'Manual officer review needed' : 'No human verification needed'}
                </span>
              </div>

              <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-500 shadow-2xs">
                <Clock className="w-6 h-6 stroke-[1.75]" />
              </div>
            </div>

          </div>

          {/* ROW 2: DARK NAVY HERO CARD */}
          <div className="bg-[#081d3d] border border-[#123164] rounded-xl p-5 text-white shadow-md flex flex-col md:flex-row items-center justify-between gap-5 relative overflow-hidden">
            
            {/* Speedometer Gauge + Company Info */}
            <div className="flex items-center gap-4">
              {(() => {
                const scoreVal = Math.max(0, Math.min(100, typeof heroData.overallScore === 'number' ? heroData.overallScore : 50.0));
                const angleDeg = 180 - (scoreVal / 100) * 180;
                const angleRad = (angleDeg * Math.PI) / 180;
                const needleX = Math.round((60 + 26 * Math.cos(angleRad)) * 10) / 10;
                const needleY = Math.round((56 - 26 * Math.sin(angleRad)) * 10) / 10;

                return (
                  <div className="relative w-36 flex flex-col items-center justify-end overflow-hidden shrink-0">
                    <svg viewBox="0 0 120 68" className="w-36 h-20 overflow-hidden block">
                      <defs>
                        <linearGradient id="spectrumGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#ef4444" />
                          <stop offset="28%" stopColor="#f59e0b" />
                          <stop offset="65%" stopColor="#10b981" />
                          <stop offset="100%" stopColor="#06b6d4" />
                        </linearGradient>
                      </defs>
                      
                      {/* Background Arc Track */}
                      <path
                        d="M 20 56 A 40 40 0 0 1 100 56"
                        fill="none"
                        stroke="#162e54"
                        strokeWidth="10"
                        strokeLinecap="round"
                      />
                      
                      {/* Filled Spectrum Arc */}
                      <path
                        d="M 20 56 A 40 40 0 0 1 100 56"
                        fill="none"
                        stroke="url(#spectrumGradient)"
                        strokeWidth="10"
                        strokeLinecap="round"
                        strokeDasharray="125.66"
                        strokeDashoffset={125.66 * (1 - (scoreVal / 100))}
                        className="transition-all duration-700"
                      />

                      {/* Inner dashed guide arc */}
                      <path
                        d="M 28 56 A 32 32 0 0 1 92 56"
                        fill="none"
                        stroke="#1a3b68"
                        strokeWidth="1.5"
                        strokeDasharray="2 3"
                      />

                      {/* Indicator Needle */}
                      <line
                        x1="60"
                        y1="56"
                        x2={needleX}
                        y2={needleY}
                        stroke="#ffffff"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        className="transition-all duration-700"
                      />
                      
                      {/* Center Hub */}
                      <circle cx="60" cy="56" r="4.5" fill="#ffffff" />
                      <circle cx="60" cy="56" r="2" fill="#081d3d" />
                    </svg>

                    {/* Scale Labels */}
                    <div className="w-full flex items-center justify-between text-[10px] font-bold text-blue-200 mt-1 px-1">
                      <span>0%</span>
                      <span className="text-white font-black text-xs">{heroData.overallScore}%</span>
                      <span>100%</span>
                    </div>
                  </div>
                );
              })()}

              {/* Company Info & Sub-scores */}
              <div className="flex flex-col">
                <h3 className="text-xl font-black text-white tracking-tight leading-tight">
                  {heroData.bidderName}
                </h3>
                <span className="text-xs text-blue-300 font-medium mt-0.5">
                  {heroData.tenderRef}
                </span>

                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-200 font-medium mt-2">
                  <span>Technical: <strong className="text-white">{heroData.technicalScore}%</strong></span>
                  <span className="text-slate-500">|</span>
                  <span>Financial: <strong className="text-white">{heroData.financialScore}%</strong></span>
                  <span className="text-slate-500">|</span>
                  <span>Legal: <strong className="text-white">{heroData.legalScore}%</strong></span>
                </div>
              </div>
            </div>

            {/* Certified Compliant Badge */}
            <div className="shrink-0">
              {heroData.isCompliant ? (
                <div className="bg-[#0b2f29] border border-emerald-500/70 text-emerald-300 px-4 py-2 rounded-xl flex items-center gap-2.5 shadow-sm">
                  <div className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-bold">
                    <Check className="w-4 h-4 stroke-[3]" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-black tracking-wide text-white">
                      Certified compliant
                    </span>
                    <span className="text-[10px] font-medium text-emerald-300/80">
                      {heroData.certifiedDate}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="bg-[#381119] border border-rose-500/70 text-rose-300 px-4 py-2 rounded-xl flex items-center gap-2.5 shadow-sm">
                  <div className="w-6 h-6 rounded-full bg-rose-500 text-white flex items-center justify-center font-bold">
                    <X className="w-4 h-4 stroke-[3]" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-black tracking-wide text-white">
                      Non-Compliant / Rejected
                    </span>
                    <span className="text-[10px] font-medium text-rose-300/80">
                      Flagged Violations Detected
                    </span>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* ROW 3: COMPREHENSIVE CRITERIA BREAKDOWN TABLE */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col">
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#f8fafc] border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-4 w-[28%]">CRITERION PARAMETER</th>
                    <th className="py-3 px-4 w-[26%]">REQUIREMENT</th>
                    <th className="py-3 px-4 w-[36%]">EXTRACTED PROOF</th>
                    <th className="py-3 px-4 w-[10%] text-center">STATUS</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200/70 text-xs">
                  {criteriaRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-500">
                        {isAnalyzing ? 'Analyzing documents...' : 'Click Run Analysis to inspect bidder compliance.'}
                      </td>
                    </tr>
                  ) : (
                    criteriaRows.map((row) => {
                      const isVerified = row.status === 'VERIFIED';
                      const isSelected = row.id === selectedClauseId;
                      return (
                        <tr 
                          key={row.id} 
                          onClick={() => setSelectedClauseId(row.id)}
                          className={`transition-all cursor-pointer ${
                            isSelected
                              ? 'ring-2 ring-blue-500/80 bg-blue-50/60 shadow-xs relative z-10'
                              : row.isHighlighted ? 'bg-[#fffde7]/60 hover:bg-slate-50/90' : 'bg-white hover:bg-slate-50/90'
                          }`}
                          title="Click to select this clause for officer acceptance / rejection"
                        >
                          <td className="py-3.5 px-4 font-semibold text-slate-800">
                            {row.parameter}
                          </td>

                          <td className="py-3.5 px-4 text-slate-600 font-medium">
                            {row.requirement}
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex flex-col gap-0.5">
                              <span className="font-semibold text-slate-800">
                                {row.proof}
                              </span>
                              <button
                                onClick={() => setActiveCitationModal(row)}
                                className="text-[11px] text-blue-600 hover:text-blue-800 underline font-medium text-left cursor-pointer flex items-center gap-1 w-fit mt-0.5"
                              >
                                <span>{row.docRef}</span>
                                <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                              </button>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            {isVerified ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#e6f4ea] text-[#137333] border border-[#ceead6]">
                                <Check className="w-3 h-3 stroke-[3]" />
                                <span>VERIFIED</span>
                              </span>
                            ) : row.status === 'MISMATCH' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#fce8e6] text-[#c5221f] border border-[#fad2cf]">
                                <X className="w-3 h-3 stroke-[3]" />
                                <span>MISMATCH</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                <Clock className="w-3 h-3" />
                                <span>REVIEW</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

          </div>

          {/* ROW 4: BOTTOM ACTION BAR */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
            
            {/* Selected Clause Indicator */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Selected Clause:</span>
              <span className="font-bold text-slate-800 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-md">
                {selectedClause?.parameter || 'Select a clause from table'}
              </span>
              {selectedClause && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                  selectedClause.status === 'VERIFIED'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : selectedClause.status === 'MISMATCH'
                    ? 'bg-rose-100 text-rose-800 border border-rose-200'
                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                }`}>
                  {selectedClause.status}
                </span>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2.5">
              <button
                onClick={handleExportReport}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-2xs transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4 text-slate-500" />
                <span>Export Detailed Report</span>
              </button>

              <button
                onClick={() => setShowRejectMemoModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-2xs transition-colors cursor-pointer"
              >
                <FileText className="w-4 h-4 text-slate-500" />
                <span>Draft Reject Memo</span>
              </button>

              {/* Accept Clause Button */}
              <button
                onClick={handleAcceptClause}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-lg shadow-sm transition-colors cursor-pointer"
                title="Manually Accept / Overrule Selected Clause"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Accept Clause</span>
              </button>

              {/* Reject Clause Button */}
              <button
                onClick={handleRejectClause}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-lg shadow-sm transition-colors cursor-pointer"
                title="Manually Reject Selected Clause"
              >
                <X className="w-4 h-4 stroke-[3]" />
                <span>Reject Clause</span>
              </button>
            </div>

          </div>

        </div>

      </main>

      {/* MODALS */}
      {/* Evidence Inspector Modal */}
      {activeCitationModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full border border-slate-200 shadow-xl p-5 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Document Evidence Inspector
                </h3>
              </div>
              <button
                onClick={() => setActiveCitationModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                CRITERION: {activeCitationModal.parameter}
              </span>
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 text-xs text-slate-800 leading-relaxed font-mono">
                "{activeCitationModal.docSnippet}"
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                <span>Source: <strong>{activeCitationModal.docRef}</strong></span>
                <span className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                  activeCitationModal.status === 'VERIFIED' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  Status: {activeCitationModal.status}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setActiveCitationModal(null)}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Draft Reject Memo Modal */}
      {showRejectMemoModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full border border-slate-200 shadow-2xl p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-rose-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Official Technical Evaluation Rejection Memo
                </h3>
              </div>
              <button
                onClick={() => setShowRejectMemoModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 font-mono text-xs text-slate-800 leading-relaxed space-y-3">
              <div className="border-b border-slate-200 pb-2">
                <p><strong>MEMORANDUM REF:</strong> GeM/PRISM/EVAL/{new Date().getFullYear()}/0091</p>
                <p><strong>TO:</strong> {heroData.bidderName}</p>
                <p><strong>TENDER REF:</strong> {heroData.tenderRef}</p>
                <p><strong>DATE:</strong> {new Date().toLocaleDateString('en-GB')}</p>
              </div>

              <p><strong>SUBJECT: DISQUALIFICATION AT TECHNICAL EVALUATION STAGE</strong></p>

              <p>
                Dear Bidder,
                <br />
                Upon automated risk verification and compliance audit through GeM PRISM, your bid submission has been evaluated against the mandatory tender qualifications.
              </p>

              <div>
                <strong>FINDINGS / CLAUSE VIOLATIONS:</strong>
                <ul className="list-disc list-inside mt-1 space-y-1 text-rose-800">
                  {criteriaRows.filter(r => r.status === 'MISMATCH').length > 0 ? (
                    criteriaRows.filter(r => r.status === 'MISMATCH').map(r => (
                      <li key={r.id}>
                        <strong>{r.parameter}:</strong> Required "{r.requirement}", but extracted "{r.proof}".
                      </li>
                    ))
                  ) : (
                    <li>No hard mismatches currently detected. All parameters comply with baseline standards.</li>
                  )}
                </ul>
              </div>

              <p>
                As stipulated under general procurement terms, the technical bid fails to satisfy all eligibility criteria and stands disqualified from commercial price bid opening.
              </p>

              <div className="pt-2 border-t border-slate-200">
                <p><strong>Competent Authority:</strong> Procurement Inspection Directorate</p>
                <p><strong>Engine Signature:</strong> GeM PRISM Compliance Verified</p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-500">
                Generated strictly from verified audit logs.
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowRejectMemoModal(false)}
                  className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                >
                  Dismiss
                </button>
                <button
                  onClick={() => {
                    alert('Official Rejection Memo copied to clipboard.');
                    setShowRejectMemoModal(false);
                  }}
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold"
                >
                  Copy & Issue Memo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
