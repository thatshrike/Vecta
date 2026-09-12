import React, { useState, useRef, useEffect } from 'react';
import { 
  UploadCloud, 
  FileText, 
  X, 
  CheckCircle2, 
  Loader2, 
  AlertCircle, 
  Play, 
  Sparkles, 
  ShieldCheck, 
  Check, 
  Globe, 
  Settings, 
  User, 
  Bell, 
  Info,
  ExternalLink,
  Share2
} from 'lucide-react';
import { analyzeTenderAndBidders } from './api/complianceApi';

export default function UploadDashboard({ onComplete }) {
  const [tenderFile, setTenderFile] = useState(null);
  const [tenderError, setTenderError] = useState('');
  
  const [bidderFiles, setBidderFiles] = useState([]);
  const [bidderError, setBidderError] = useState('');
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoadingSamples, setIsLoadingSamples] = useState(false);

  const tenderInputRef = useRef(null);
  const bidderInputRef = useRef(null);

  // Auto-load sample dataset initially to match Image 2 directly!
  useEffect(() => {
    loadSampleDataset(false);
  }, []);

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleTenderDrop = (e) => {
    e.preventDefault();
    setTenderError('');
    const file = e.dataTransfer ? e.dataTransfer.files[0] : e.target.files[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setTenderError('Only PDF files are supported.');
      return;
    }
    setTenderFile(file);
  };

  const deriveBidderName = (filename) => {
    return filename
      .replace(/\.pdf$/i, '')
      .replace(/^bidder_/i, '')
      .replace(/_/g, ' ')
      .toUpperCase();
  };

  const handleBidderDrop = (e) => {
    e.preventDefault();
    setBidderError('');
    const files = Array.from(e.dataTransfer ? e.dataTransfer.files : e.target.files);
    
    let newBidders = [];
    let errorMsg = '';
    
    files.forEach(file => {
      if (file.type !== 'application/pdf') {
        errorMsg = 'Some files were rejected (only PDF supported).';
        return;
      }
      if (bidderFiles.some(b => b.file.name === file.name)) {
        errorMsg = 'Duplicate files were skipped.';
        return;
      }
      newBidders.push({
        id: Math.random().toString(36).substr(2, 9),
        file,
        derivedName: deriveBidderName(file.name)
      });
    });

    if (errorMsg) setBidderError(errorMsg);
    if (newBidders.length > 0) {
      setBidderFiles(prev => [...prev, ...newBidders]);
    }
    if (e.target.value) e.target.value = '';
  };

  const handleRemoveBidder = (id) => {
    setBidderFiles(prev => prev.filter(b => b.id !== id));
  };

  const loadSampleDataset = async (showLoading = true) => {
    if (showLoading) setIsLoadingSamples(true);
    setTenderError('');
    setBidderError('');
    try {
      const tenderResp = await fetch('/samples/tender_bhel.pdf');
      const tenderBlob = await tenderResp.blob();
      const loadedTenderFile = new File([tenderBlob], 'tender_bhel.pdf', { type: 'application/pdf' });
      setTenderFile(loadedTenderFile);

      const b1Resp = await fetch('/samples/bidder_compliant.pdf');
      const b1Blob = await b1Resp.blob();
      const loadedB1 = new File([b1Blob], 'bidder_compliant.pdf', { type: 'application/pdf' });

      const b2Resp = await fetch('/samples/bidder_noncompliant.pdf');
      const b2Blob = await b2Resp.blob();
      const loadedB2 = new File([b2Blob], 'bidder_noncompliant.pdf', { type: 'application/pdf' });

      setBidderFiles([
        {
          id: 'sample-1',
          file: loadedB1,
          derivedName: 'COMPLIANT ENTERPRISE'
        },
        {
          id: 'sample-2',
          file: loadedB2,
          derivedName: 'NON-COMPLIANT VENDOR'
        }
      ]);
    } catch (err) {
      console.error('Failed to load sample dataset:', err);
    } finally {
      if (showLoading) setIsLoadingSamples(false);
    }
  };

  const handleRunAnalysis = async () => {
    if (!tenderFile || bidderFiles.length === 0) return;
    setIsAnalyzing(true);
    setBidderError('');
    setTenderError('');

    try {
      const reports = await analyzeTenderAndBidders(tenderFile, bidderFiles);
      onComplete(reports);
    } catch (error) {
      console.error(error);
      setBidderError(error.message);
      setIsAnalyzing(false);
    }
  };

  const canRun = tenderFile && bidderFiles.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#e8edf3] via-[#e2e9f0] to-[#dae3ec] font-sans text-slate-800 flex flex-col select-none">
      
      {/* 1. Dark Navy Top Navigation Bar (Matches Image 2) */}
      <header className="h-14 bg-[#0b1320] text-slate-200 border-b border-[#1c293d] px-6 flex items-center justify-between shrink-0 shadow-sm">
        
        {/* Left: Brand + Badges */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#2563eb] text-white flex items-center justify-center shadow-md shadow-blue-500/30">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <span className="font-black text-base text-white tracking-wider">VECTA</span>
          
          <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-[#1e293b] text-slate-300 border border-slate-700/80">
            v2.0 Core
          </span>
          
          <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-[#064e3b]/70 text-emerald-400 border border-emerald-500/40 flex items-center gap-1.5 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            FastAPI: 8000
          </span>
        </div>

        {/* Right: Global Controls & Actions */}
        <div className="flex items-center gap-4 text-xs">
          <button className="hidden lg:flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors cursor-pointer">
            <Globe className="w-3.5 h-3.5 text-slate-400" />
            <span>Global controls</span>
          </button>

          <div className="hidden sm:flex items-center gap-3 text-slate-400 pl-1">
            <Settings className="w-4 h-4 hover:text-white cursor-pointer transition-colors" />
            <User className="w-4 h-4 hover:text-white cursor-pointer transition-colors" />
            <Bell className="w-4 h-4 hover:text-white cursor-pointer transition-colors" />
          </div>
        </div>

      </header>

      {/* 2. Main Content Canvas */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 md:p-10 overflow-y-auto">
        <div className="max-w-4xl w-full flex flex-col gap-6">
          
          {/* Title Row: Evaluation Setup + Green Status Pill */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-600 shadow-xs">
                <Share2 className="w-4.5 h-4.5" />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">
                Evaluation Setup
              </h1>
            </div>

            <span className="px-3.5 py-1 rounded-full text-xs font-extrabold bg-[#e6f7ed] text-[#12a150] border border-[#a8e6c1] shadow-2xs tracking-wide">
              COMPLIANT
            </span>
          </div>

          {/* CARD 1: Tender Document (ATC / NIT Specification) */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm relative overflow-hidden flex flex-col gap-4">
            
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">1</span>
                Tender Document (ATC / NIT Specification)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                The primary source of truth containing eligibility, turnover criteria, and technical clauses.
              </p>
            </div>

            {/* Inner Content Box with File and Watermark Background */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-1">
              
              {!tenderFile ? (
                <div 
                  onClick={() => tenderInputRef.current.click()}
                  className="w-full sm:w-84 border-2 border-dashed border-blue-300 hover:border-blue-500 bg-blue-50/40 hover:bg-blue-50/80 rounded-xl p-4 flex items-center gap-3 cursor-pointer transition-colors"
                >
                  <UploadCloud className="w-6 h-6 text-blue-600 shrink-0" />
                  <div className="text-left">
                    <span className="font-bold text-xs text-blue-700">Click to upload Tender PDF</span>
                    <p className="text-[10px] text-slate-400">PDF documents only</p>
                  </div>
                </div>
              ) : (
                <div className="w-full sm:w-88 bg-[#f4f8fc] border border-blue-200/80 rounded-xl p-3 flex items-center gap-3 shadow-2xs">
                  <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-xs text-slate-900 truncate">{tenderFile.name}</p>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">{formatSize(tenderFile.size)}</p>
                  </div>
                </div>
              )}

              {/* Watermark Illustration Graphic (Center-Right in Card 1) */}
              <div className="hidden md:flex items-center gap-3 text-slate-300 opacity-60 pointer-events-none select-none">
                <div className="border border-slate-300 rounded-lg p-2.5 flex flex-col gap-1 w-24 bg-slate-50/50">
                  <div className="h-1.5 bg-slate-300 rounded w-12"></div>
                  <div className="h-1 bg-slate-200 rounded w-16"></div>
                  <div className="h-1 bg-slate-200 rounded w-14"></div>
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-[8px] font-mono text-slate-400 font-bold">CONTRACT</span>
                    <div className="w-3.5 h-3.5 rounded-full border border-slate-300 flex items-center justify-center text-[7px]">🕒</div>
                  </div>
                </div>
              </div>

              {/* Right Action Chips */}
              <div className="flex items-center gap-2 self-end sm:self-center">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#e6f7ed] text-[#12a150] border border-[#a8e6c1] flex items-center gap-1 shadow-2xs">
                  <Check className="w-3.5 h-3.5" /> Ready for Parsing
                </span>

                <button 
                  onClick={() => tenderInputRef.current.click()}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span>Replace File</span>
                  <span className="text-[10px] text-slate-400">↗</span>
                </button>

                <button 
                  className="w-7 h-7 rounded-full border border-slate-200 text-slate-400 hover:text-slate-600 bg-white hover:bg-slate-50 flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
                  title="Document ATC requirements details"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </div>

            </div>

            <input type="file" accept="application/pdf" className="hidden" ref={tenderInputRef} onChange={handleTenderDrop} />
          </div>

          {/* CARD 2: Bidder Proposals & Submissions (2) */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm relative flex flex-col gap-4">
            
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">2</span>
                  Bidder Proposals & Submissions ({bidderFiles.length})
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Upload one or multiple bidder technical & statutory submissions to evaluate side-by-side.
                </p>
              </div>

              <button 
                onClick={() => bidderInputRef.current.click()}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Add More Bidders</span>
              </button>
            </div>

            {/* Inner Dashed Border Container */}
            <div 
              onDragOver={e => e.preventDefault()}
              onDrop={handleBidderDrop}
              className="border-2 border-dashed border-slate-200 rounded-2xl p-4 bg-[#fbfcfd] flex flex-col gap-3 min-h-[140px] justify-center"
            >
              {bidderFiles.length === 0 ? (
                <div 
                  onClick={() => bidderInputRef.current.click()}
                  className="py-8 flex flex-col items-center justify-center text-center cursor-pointer"
                >
                  <UploadCloud className="w-8 h-8 text-blue-500 mb-1" />
                  <span className="font-bold text-xs text-blue-600">Click to upload Bidder Submissions</span>
                  <p className="text-[11px] text-slate-400 mt-0.5">Drag and drop multiple PDF files here</p>
                </div>
              ) : (
                bidderFiles.map((bidder, index) => (
                  <div 
                    key={bidder.id}
                    className="bg-white border border-slate-200/90 rounded-xl p-3.5 flex items-center justify-between shadow-2xs"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-extrabold text-xs text-slate-900 truncate">
                          {bidder.derivedName}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono truncate">
                          {bidder.file.name} ({formatSize(bidder.file.size)})
                        </span>
                      </div>
                    </div>

                    {/* Progress slider bar + Delete Cross (Matches Image 2) */}
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden flex">
                        <div 
                          className="h-full bg-slate-600 rounded-full" 
                          style={{ width: index === 0 ? '65%' : '55%' }}
                        ></div>
                      </div>

                      <button
                        onClick={() => handleRemoveBidder(bidder.id)}
                        className="text-slate-400 hover:text-rose-500 p-1 rounded transition-colors cursor-pointer"
                        title="Remove bidder"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <input type="file" multiple accept="application/pdf" className="hidden" ref={bidderInputRef} onChange={handleBidderDrop} />
          </div>

          {bidderError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{bidderError}</span>
            </div>
          )}

          {/* Bottom Bar: Target API + Blue Action Button */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-1">
            <div className="text-xs text-slate-500 font-mono">
              Target API: <strong className="text-slate-900 font-bold font-mono">POST http://localhost:8000/analyze</strong>
            </div>

            <button
              onClick={handleRunAnalysis}
              disabled={!canRun || isAnalyzing}
              className={`px-6 py-2.5 rounded-xl font-extrabold text-xs text-white shadow-md flex items-center gap-2 transition-all cursor-pointer ${
                !canRun || isAnalyzing
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                  : 'bg-[#2563eb] hover:bg-[#1d4ed8] shadow-blue-500/25 hover:scale-[1.01]'
              }`}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Running Analysis...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Run Compliance Analysis ({bidderFiles.length} bidders)</span>
                </>
              )}
            </button>
          </div>

        </div>
      </main>

    </div>
  );
}
