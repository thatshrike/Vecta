import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, X, CheckCircle, Loader2, AlertCircle, Play, Edit2 } from 'lucide-react';

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
        derivedName: deriveBidderName(file.name)
      });
    });

    if (errorMsg) setBidderError(errorMsg);
    if (newBidders.length > 0) {
      setBidderFiles(prev => [...prev, ...newBidders]);
    }
    
    // Reset input so the same file can be selected again if it was removed
    if (e.target.value) e.target.value = '';
  };

  const handleRemoveBidder = (id) => {
    setBidderFiles(prev => prev.filter(b => b.id !== id));
  };

  const handleNameChange = (id, newName) => {
    setBidderFiles(prev => prev.map(b => b.id === id ? { ...b, derivedName: newName } : b));
  };

  const handleRunAnalysis = () => {
    setIsSimulating(true);
    
    // Initialize status for all bidders
    const initialStatus = {};
    bidderFiles.forEach(b => initialStatus[b.id] = 'pending');
    setSimulationStatus(initialStatus);

    let currentIdx = 0;
    
    const runNext = () => {
      if (currentIdx >= bidderFiles.length) {
        // All done, transition after a small delay
        setTimeout(() => {
          // TODO: Replace this simulation with real fetch() to backend
          onComplete(bidderFiles);
        }, 1000);
        return;
      }

      const currentBidder = bidderFiles[currentIdx];
      
      setSimulationStatus(prev => ({ ...prev, [currentBidder.id]: 'running' }));
      
      setTimeout(() => {
        setSimulationStatus(prev => ({ ...prev, [currentBidder.id]: 'done' }));
        currentIdx++;
        runNext();
      }, 2000); // 2 second delay per bidder
    };

    // Start simulation
    runNext();
  };

  const canRun = tenderFile && bidderFiles.length > 0;

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-gray-900 flex justify-center overflow-y-auto">
      <div className="max-w-4xl w-full flex flex-col gap-8">
        
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-black tracking-tight text-gray-900">Document Upload</h1>
          <p className="text-gray-500 font-medium">Upload the tender requirements and bidder submissions to begin the compliance check.</p>
        </div>

        {/* SECTION 1: Tender Document */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Tender Document (ATC / NIT)</h2>
            <p className="text-sm text-gray-500">The source of truth containing all requirements.</p>
          </div>

          {!tenderFile ? (
            <div 
              onDragOver={e => e.preventDefault()} 
              onDrop={handleTenderDrop}
              onClick={() => tenderInputRef.current.click()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-10 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-gray-50 hover:border-indigo-400 transition-colors"
            >
              <UploadCloud className="w-10 h-10 text-gray-400" />
              <div className="text-center">
                <span className="font-semibold text-indigo-600">Click to upload</span> or drag and drop
                <p className="text-xs text-gray-500 mt-1">PDF files only (Max 50MB)</p>
              </div>
              <input type="file" accept="application/pdf" className="hidden" ref={tenderInputRef} onChange={handleTenderDrop} />
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 bg-indigo-50 border border-indigo-100 rounded-md">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded text-indigo-600">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{tenderFile.name}</p>
                  <p className="text-xs text-gray-500">{formatSize(tenderFile.size)}</p>
                </div>
              </div>
              <button 
                onClick={() => { setTenderFile(null); setTenderError(''); }}
                className="text-sm font-medium text-indigo-600 hover:text-indigo-800 bg-white px-3 py-1.5 rounded border border-indigo-200 shadow-sm transition-colors"
              >
                Replace
              </button>
            </div>
          )}
          {tenderError && <p className="text-sm text-red-600 flex items-center gap-1.5"><AlertCircle className="w-4 h-4"/>{tenderError}</p>}
        </div>

        {/* SECTION 2: Bidder Submissions */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 flex flex-col gap-4">
          <div className="flex justify-between items-end">
            <div>
              <h2 className="text-lg font-bold text-gray-800">Bidder Submissions</h2>
              <p className="text-sm text-gray-500">Upload one or more bidder proposals to evaluate against the tender.</p>
            </div>
            {bidderFiles.length > 0 && (
              <button 
                onClick={() => bidderInputRef.current.click()}
                className="text-sm font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5"
              >
                <UploadCloud className="w-4 h-4" /> Add more
              </button>
            )}
          </div>

          <div 
            onDragOver={e => e.preventDefault()} 
            onDrop={handleBidderDrop}
            onClick={() => bidderFiles.length === 0 && bidderInputRef.current.click()}
            className={`border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center gap-3 transition-colors
              ${bidderFiles.length === 0 ? 'cursor-pointer hover:bg-gray-50 hover:border-indigo-400 py-10' : 'bg-gray-50'}`}
          >
            {bidderFiles.length === 0 ? (
              <>
                <UploadCloud className="w-10 h-10 text-gray-400" />
                <div className="text-center">
                  <span className="font-semibold text-indigo-600">Click to upload</span> or drag and drop
                  <p className="text-xs text-gray-500 mt-1">PDF files only</p>
                </div>
              </>
            ) : (
              <div className="w-full flex flex-col gap-2">
                {bidderFiles.map(bidder => (
                  <div key={bidder.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-md shadow-sm">
                    <div className="flex items-center gap-3 flex-1">
                      <FileText className="w-5 h-5 text-gray-400" />
                      <div className="flex flex-col flex-1">
                        <div className="flex items-center gap-2 group">
                          <input 
                            type="text" 
                            value={bidder.derivedName}
                            onChange={(e) => handleNameChange(bidder.id, e.target.value)}
                            className="font-bold text-sm text-gray-800 bg-transparent border-b border-transparent focus:border-indigo-400 focus:outline-none transition-colors w-48"
                            title="Edit bidder name"
                          />
                          <Edit2 className="w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <p className="text-xs text-gray-500 font-mono truncate max-w-xs">{bidder.file.name} ({formatSize(bidder.file.size)})</p>
                      </div>
                    </div>
                    
                    {isSimulating ? (
                      <div className="w-24 flex justify-end">
                        {simulationStatus[bidder.id] === 'pending' && <span className="text-xs font-semibold text-gray-400">Waiting...</span>}
                        {simulationStatus[bidder.id] === 'running' && <span className="text-xs font-semibold text-indigo-600 flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin"/> Analyzing</span>}
                        {simulationStatus[bidder.id] === 'done' && <span className="text-xs font-bold text-green-600 flex items-center gap-1.5"><CheckCircle className="w-3 h-3"/> Done</span>}
                      </div>
                    ) : (
                      <button onClick={() => handleRemoveBidder(bidder.id)} className="text-gray-400 hover:text-red-500 transition-colors p-1">
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <input type="file" multiple accept="application/pdf" className="hidden" ref={bidderInputRef} onChange={handleBidderDrop} />
          </div>
          {bidderError && <p className="text-sm text-red-600 flex items-center gap-1.5"><AlertCircle className="w-4 h-4"/>{bidderError}</p>}
        </div>

        {/* SECTION 3: Action */}
        <div className="flex justify-end pt-4 border-t border-gray-200">
          <button
            onClick={handleRunAnalysis}
            disabled={!canRun || isSimulating}
            className={`px-6 py-3 rounded-md font-bold text-sm flex items-center gap-2 transition-all shadow-sm
              ${(!canRun || isSimulating) 
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
                : 'bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-md'}`}
          >
            {isSimulating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                {canRun ? <Play className="w-4 h-4 fill-current" /> : <UploadCloud className="w-4 h-4" />}
                {canRun ? `Run Compliance Check (${bidderFiles.length} bidder${bidderFiles.length > 1 ? 's' : ''})` : 'Upload documents to begin'}
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
