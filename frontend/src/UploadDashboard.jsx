import React, { useState, useRef } from 'react';

export default function UploadDashboard({ onComplete }) {
  const [tenderFile, setTenderFile] = useState(null);
  const [tenderError, setTenderError] = useState('');

  const [bidderFiles, setBidderFiles] = useState([]);
  const [bidderError, setBidderError] = useState('');

  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationStatus, setSimulationStatus] = useState({}); // { [bidderName]: 'pending' | 'running' | 'done' }

  const tenderInputRef = useRef(null);
  const bidderInputRef = useRef(null);

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
      setTenderError('Only PDF files are allowed.');
      return;
    }
    setTenderFile(file);
  };

  const deriveBidderName = (filename) => {
    return filename.replace(/\.pdf$/i, '').replace(/^bidder_/i, '').replace(/_/g, ' ').toUpperCase();
  };

  const handleBidderDrop = (e) => {
    e.preventDefault();
    setBidderError('');
    const files = Array.from(e.dataTransfer ? e.dataTransfer.files : e.target.files);

    let newBidders = [];
    let errorMsg = '';

    files.forEach(file => {
      if (file.type !== 'application/pdf') {
        errorMsg = 'Some files were rejected (only PDFs allowed).';
        return;
      }
      if (bidderFiles.some(b => b.file.name === file.name)) {
        errorMsg = 'Duplicate files were skipped.';
        return;
      }
      newBidders.push({
        id: Math.random().toString(36).substr(2, 9),
        file,
        derivedName: deriveBidderName(file.name),
        vendorId: ''
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

  const handleNameChange = (id, newName) => {
    setBidderFiles(prev => prev.map(b => b.id === id ? { ...b, derivedName: newName } : b));
  };

  const handleVendorIdChange = (id, newId) => {
    setBidderFiles(prev => prev.map(b => b.id === id ? { ...b, vendorId: newId } : b));
  };

  const handleRunAnalysis = async () => {
    setIsSimulating(true);
    setBidderError('');
    setTenderError('');

    const initialStatus = {};
    bidderFiles.forEach(b => initialStatus[b.id] = 'running');
    setSimulationStatus(initialStatus);

    try {
      const formData = new FormData();
      formData.append('tender', tenderFile);

      bidderFiles.forEach(b => {
        formData.append('bidders', b.file);
      });

      const derivedNames = bidderFiles.map(b => b.derivedName);
      formData.append('bidder_names', JSON.stringify(derivedNames));
      
      const vendorIds = bidderFiles.map(b => b.vendorId);
      formData.append('vendor_ids', JSON.stringify(vendorIds));

      const resolvedIds = bidderFiles.map(b => b.vendorId.trim() || b.derivedName);
      const idSet = new Set(resolvedIds);
      if (idSet.size !== resolvedIds.length) {
        setBidderError('Bidder conflict: two packets resolve to the same ID — enter a unique Vendor ID for each or rename the files.');
        setIsSimulating(false);
        return;
      }

      const response = await fetch('http://localhost:8000/analyze', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Analysis failed: ${response.status} — ${errText.substring(0, 100)}`);
      }

      const reports = await response.json();

      const finalStatus = {};
      bidderFiles.forEach(b => finalStatus[b.id] = 'done');
      setSimulationStatus(finalStatus);

      setTimeout(() => {
        onComplete(reports);
      }, 500);

    } catch (error) {
      console.error(error);
      const isNetworkError = error.message.includes('Failed to fetch') || error.message.includes('NetworkError');
      if (isNetworkError) {
        setBidderError('Backend unavailable — make sure the Python API server is running on port 8000 (python api_server.py)');
      } else {
        setBidderError(error.message);
      }

      const resetStatus = {};
      bidderFiles.forEach(b => resetStatus[b.id] = 'pending');
      setSimulationStatus(resetStatus);
      setIsSimulating(false);
    }
  };

  const canRun = tenderFile && bidderFiles.length > 0;

  const canRun = tenderFile && bidderFiles.length > 0;

  return (
    <div className="flex flex-col w-full p-4 lg:p-8">
      {/* Sub-Header / Tender Workflow Step Indicator */}
      <div className="bg-surface-container-lowest border-b border-outline-variant shadow-sm px-gutter py-space-md mb-space-lg flex flex-col xl:flex-row xl:items-center justify-between gap-space-md rounded-lg">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-space-xs font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">
            <span>GeM Institutional Procurement</span>
            <span className="text-outline-variant">/</span>
            <span>Technical Evaluation Pipeline</span>
            <span className="text-outline-variant">/</span>
            <span className="text-secondary font-bold">Ingestion Engine</span>
          </div>
          <div className="flex items-center gap-space-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-secondary animate-pulse"></span>
            <h1 className="font-headline-md text-headline-md text-primary font-bold tracking-tight">
              Tender & Multi-Bidder Ingestion Workspace
            </h1>
          </div>
        </div>
        {/* 3-Step Breadcrumb Progress Indicator */}
        <div className="flex items-center gap-space-xs bg-surface-container-low border border-outline-variant px-space-md py-space-xs rounded">
          <div className="flex items-center gap-space-xs">
            <div className="w-6 h-6 rounded-full bg-secondary text-on-primary font-mono-data-sm text-mono-data-sm flex items-center justify-center font-bold">1</div>
            <div className="flex flex-col">
              <span className="font-label-caps text-label-caps uppercase text-secondary font-bold">Step 1: Ingestion</span>
              <span className="font-mono-data-sm text-mono-data-sm text-on-surface-variant">Active Workspace</span>
            </div>
          </div>
          <span className="material-symbols-outlined text-outline-variant text-[18px] px-1">chevron_right</span>
          <div className="flex items-center gap-space-xs opacity-60">
            <div className="w-6 h-6 rounded-full bg-surface-container-high text-on-surface-variant font-mono-data-sm text-mono-data-sm flex items-center justify-center">2</div>
            <div className="flex flex-col">
              <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">Step 2: OCR & Semantic</span>
              <span className="font-mono-data-sm text-mono-data-sm text-on-surface-variant">Pending Run</span>
            </div>
          </div>
          <span className="material-symbols-outlined text-outline-variant text-[18px] px-1">chevron_right</span>
          <div className="flex items-center gap-space-xs opacity-60">
            <div className="w-6 h-6 rounded-full bg-surface-container-high text-on-surface-variant font-mono-data-sm text-mono-data-sm flex items-center justify-center">3</div>
            <div className="flex flex-col">
              <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">Step 3: Clause Matrix</span>
              <span className="font-mono-data-sm text-mono-data-sm text-on-surface-variant">TEC Evaluation</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Asymmetric Command Layout */}
      <div className="pb-space-xl flex flex-col xl:flex-row items-start gap-space-lg">
        {/* Left Operational Rail */}
        <aside className="w-full xl:w-[380px] shrink-0 flex flex-col gap-space-lg xl:sticky xl:top-[128px]">
          
          {/* Tender Master Document */}
          <section className="bg-surface-container-lowest border border-outline-variant rounded p-space-md shadow-sm">
            <div className="flex items-center justify-between pb-space-xs mb-space-sm border-b border-outline-variant">
              <div className="flex items-center gap-space-xs">
                <span className="w-7 h-7 rounded bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-900 font-bold">
                  <span className="material-symbols-outlined text-[18px]">assignment</span>
                </span>
                <div>
                  <h2 className="font-headline-sm text-[15px] font-bold text-primary leading-tight">Tender Master Document</h2>
                </div>
              </div>
              <span className="px-space-xs py-0.5 bg-amber-100 border border-amber-300 text-amber-900 font-mono-data-sm text-[10px] rounded font-medium">Benchmark Active</span>
            </div>
            
            {!tenderFile ? (
              <div 
                onDragOver={e => e.preventDefault()} 
                onDrop={handleTenderDrop}
                onClick={() => tenderInputRef.current.click()}
                className="bg-surface-container-low border-2 border-dashed border-outline-variant p-space-lg rounded flex flex-col items-center justify-center gap-space-sm cursor-pointer hover:border-secondary hover:bg-surface-container transition-colors min-h-[140px]"
              >
                <span className="material-symbols-outlined text-stone-400 text-[32px]">upload_file</span>
                <div className="text-center">
                  <span className="font-body-sm font-semibold text-primary block">Click to upload or drag & drop</span>
                  <span className="font-mono-data-sm text-on-surface-variant mt-1 block">PDF files only (Max 50MB)</span>
                </div>
                <input type="file" accept="application/pdf" className="hidden" ref={tenderInputRef} onChange={handleTenderDrop} />
              </div>
            ) : (
              <div className="bg-surface-container-low border border-outline-variant p-space-sm rounded flex flex-col gap-space-sm">
                <div className="flex items-center gap-space-sm">
                  <div className="w-9 h-11 rounded bg-error/10 text-error flex flex-col items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[20px]">picture_as_pdf</span>
                    <span className="font-mono-data-sm text-[9px] uppercase font-bold">PDF</span>
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="font-body-sm text-[13px] font-semibold text-primary truncate" title={tenderFile.name}>{tenderFile.name}</div>
                    <div className="flex items-center gap-1.5 text-on-surface-variant text-mono-data-sm text-[11px] flex-wrap mt-0.5">
                      <span className="px-space-xs py-[1px] bg-surface-container-lowest text-on-surface-variant font-mono-data-sm text-[10px] rounded border border-outline-variant">{formatSize(tenderFile.size)}</span>
                      <span>•</span>
                      <span className="flex items-center gap-0.5 text-secondary font-medium"><span className="material-symbols-outlined text-[13px]">verified</span> Ready for AI</span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 pt-space-xs border-t border-outline-variant/60">
                  <button onClick={() => { setTenderFile(null); setTenderError(''); }} className="px-space-xs py-1.5 bg-surface-container-lowest text-error rounded font-body-sm text-body-sm font-medium hover:bg-error-container transition-colors flex items-center justify-center gap-1 border border-outline-variant">
                    <span className="material-symbols-outlined text-[16px]">upload_file</span> Replace Tender PDF
                  </button>
                </div>
              </div>
            )}
            {tenderError && <p className="text-sm text-error mt-2 font-body-sm">{tenderError}</p>}
          </section>



          {/* Ingestion Summary */}
          <section className="bg-surface-container-lowest border border-outline-variant rounded p-space-md shadow-sm">
            <div className="flex items-center justify-between pb-space-xs mb-space-sm border-b border-outline-variant">
              <h3 className="font-headline-sm text-[15px] font-bold text-primary">Ingestion Summary</h3>
              <span className="font-mono-data text-mono-data text-secondary font-semibold">{tenderFile ? 1 + bidderFiles.length : bidderFiles.length} PDFs Total</span>
            </div>
            <div className="flex flex-col gap-space-sm">
              <div className="flex items-center justify-between font-mono-data-sm text-mono-data-sm pt-1">
                <span className="text-on-surface-variant">Staged Bidder Packets</span>
                <span className="font-semibold text-primary">{bidderFiles.length} Packets</span>
              </div>
              <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
                <div className="bg-gradient-to-r from-amber-600 to-amber-700 h-full transition-all" style={{ width: Math.min((bidderFiles.length / 5) * 100, 100) + '%' }}></div>
              </div>
              <div className="flex items-center justify-between font-mono-data-sm text-mono-data-sm pt-1">
                <span className="text-on-surface-variant">Estimated Processing Time</span>
                <span className="font-semibold text-primary">~{canRun ? (bidderFiles.length * 15) : 0} Seconds</span>
              </div>
            </div>
          </section>

          {/* Primary Action CTA Hub */}
          <div className="flex flex-col gap-space-sm">
            <button
              onClick={handleRunAnalysis}
              disabled={!canRun || isSimulating}
              className={`w-full py-space-md px-space-lg rounded font-body-md text-body-md font-bold transition-all flex items-center justify-center gap-space-sm border ${
                (!canRun || isSimulating) 
                  ? 'bg-surface-dim text-on-surface-variant border-outline cursor-not-allowed' 
                  : 'bg-amber-700 hover:bg-amber-800 text-on-primary border-amber-600 shadow-md hover:shadow-lg'
              }`}
            >
              {isSimulating ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[20px]">sync</span>
                  <span>Processing with AI...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[20px]">play_arrow</span>
                  <span>Start AI Evaluation & Extraction</span>
                </>
              )}
            </button>
            <button className="w-full py-space-xs bg-surface-container-lowest text-on-surface rounded font-body-sm text-body-sm font-semibold hover:bg-surface-container-low transition-colors text-center border border-outline-variant">Save Draft</button>
          </div>
        </aside>

        {/* Right / Expanded Primary Workspace */}
        <section className="flex-1 min-w-0 bg-surface-container-lowest border border-outline-variant rounded p-space-lg shadow-sm flex flex-col h-full">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-space-md mb-space-md border-b border-outline-variant gap-space-sm">
            <div>
              <div className="flex items-center gap-space-xs">
                <h2 className="font-headline-sm text-headline-sm font-bold text-primary">Multi-Bidder Submissions Ingestion</h2>
                <span className="px-space-xs py-[1px] bg-amber-700 text-on-primary font-mono-data-sm text-mono-data-sm rounded font-semibold">
                  {bidderFiles.length} Bidders Loaded
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">Upload technical packets, OEM authorizations, and compliance schedules.</p>
            </div>
            <div className="flex items-center gap-space-xs">
              <button onClick={() => bidderInputRef.current.click()} className="px-space-md py-1.5 bg-secondary text-on-primary rounded font-body-sm text-body-sm font-semibold hover:bg-amber-800 transition-colors flex items-center gap-1 shadow-sm">
                <span className="material-symbols-outlined text-[16px]">add_circle</span>
                Add Bidder Packet
              </button>
              <input type="file" multiple accept="application/pdf" className="hidden" ref={bidderInputRef} onChange={handleBidderDrop} />
            </div>
          </div>

          <div className="flex-1 flex flex-col gap-space-md mb-space-lg">
            {bidderFiles.map((bidder, idx) => (
              <div key={bidder.id} className="bg-surface-bright p-space-md rounded border border-outline-variant hover:border-amber-400 transition-colors shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-xs pb-space-xs border-b border-outline-variant">
                  <div className="flex items-center gap-space-sm flex-1">
                    <span className="w-7 h-7 rounded bg-amber-100 border border-amber-300 text-amber-900 font-mono-data text-mono-data font-bold flex items-center justify-center text-[12px]">B{idx + 1}</span>
                    <div className="flex items-center gap-space-xs flex-1 group">
                      <input 
                        type="text" 
                        value={bidder.derivedName}
                        onChange={(e) => handleNameChange(bidder.id, e.target.value)}
                        className="font-headline-sm text-[15px] font-bold text-primary bg-transparent border-b border-transparent hover:border-outline-variant focus:border-secondary focus:outline-none transition-colors max-w-full"
                        title="Edit bidder name"
                        placeholder="Bidder Name"
                      />
                      <span className="material-symbols-outlined text-[14px] text-stone-300 opacity-0 group-hover:opacity-100">edit</span>
                    </div>
                    <div className="flex items-center gap-space-xs w-[140px] group border-l border-outline-variant pl-space-sm">
                      <input 
                        type="text" 
                        value={bidder.vendorId}
                        onChange={(e) => handleVendorIdChange(bidder.id, e.target.value)}
                        className="font-mono-data-sm text-[12px] text-on-surface-variant bg-transparent border-b border-transparent hover:border-outline-variant focus:border-secondary focus:outline-none transition-colors w-full placeholder:text-amber-600"
                        title="Edit Vendor ID"
                        placeholder="Vendor ID (optional)"
                      />
                    </div>
                  </div>
                  
                  {isSimulating ? (
                    <div className="flex items-center gap-2">
                      {simulationStatus[bidder.id] === 'pending' && <span className="font-mono-data-sm text-on-surface-variant">Waiting...</span>}
                      {simulationStatus[bidder.id] === 'running' && <span className="font-mono-data-sm text-secondary flex items-center gap-1"><span className="material-symbols-outlined animate-spin text-[14px]">sync</span> Analyzing</span>}
                      {simulationStatus[bidder.id] === 'done' && <span className="font-mono-data-sm text-emerald-600 flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">check_circle</span> Done</span>}
                    </div>
                  ) : (
                    <button onClick={() => handleRemoveBidder(bidder.id)} className="text-outline hover:text-error transition-colors p-1" title="Remove bidder">
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-xs mt-space-sm">
                  <div className="px-space-xs py-1.5 bg-surface-container-lowest rounded border border-outline-variant flex items-center justify-between min-w-0">
                    <div className="truncate font-mono-data-sm text-mono-data-sm text-primary font-medium" title={bidder.file.name}>{bidder.file.name}</div>
                    <span className="font-mono-data-sm text-[10px] text-outline ml-1 shrink-0">{formatSize(bidder.file.size)}</span>
                  </div>
                </div>
              </div>
            ))}

            {bidderFiles.length === 0 && (
              <div className="flex-1 flex items-center justify-center min-h-[200px]">
                <div className="text-center text-on-surface-variant">
                  <span className="material-symbols-outlined text-[48px] text-outline opacity-50 mb-2">inventory_2</span>
                  <p className="font-body-md text-body-md font-medium">No bidders loaded yet.</p>
                  <p className="font-body-sm text-body-sm mt-1">Add bidder packets to start evaluation.</p>
                </div>
              </div>
            )}
            {bidderError && <p className="text-sm text-error mt-2 font-body-sm flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">error</span> {bidderError}</p>}
          </div>

          <div 
            onDragOver={e => e.preventDefault()} 
            onDrop={handleBidderDrop}
            onClick={() => bidderInputRef.current.click()}
            className="border-2 border-dashed border-amber-700/30 rounded-xl p-space-lg text-center cursor-pointer hover:border-secondary transition-colors bg-surface-container-low/50 flex flex-col items-center justify-center gap-space-xs"
          >
            <div className="w-10 h-10 rounded-full bg-amber-100 border border-amber-300 text-secondary flex items-center justify-center">
              <span className="material-symbols-outlined text-[24px]">cloud_upload</span>
            </div>
            <div className="font-body-md text-body-md font-semibold text-primary">Drag & drop additional bidder packets or technical schedules</div>
            <div className="font-body-sm text-body-sm text-on-surface-variant">Supports multi-page searchable PDFs up to 100MB each</div>
          </div>
        </section>
      </div>
    </div>
  );
}
