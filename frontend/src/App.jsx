import React, { useState } from 'react';
import UploadDashboard from './UploadDashboard';
import BidDashboard from './BidDashboard';

export default function App() {
  const [view, setView] = useState('upload'); // 'upload' | 'results'
  const [reports, setReports] = useState([]);
  const [activeReportIdx, setActiveReportIdx] = useState(0);

  const handleAnalysisComplete = (newReports) => {
    setReports(newReports);
    setView('results');
  };

  if (view === 'upload') {
    return <UploadDashboard onComplete={handleAnalysisComplete} />;
  }

  const activeReport = reports[activeReportIdx] || null;
  const showTabs = reports.length > 1;

  return (
    <div className="flex flex-col h-screen">
      {showTabs && (
        <div className="bg-gray-900 text-gray-400 flex items-end px-4 pt-2 shrink-0 border-b border-gray-800">
          {reports.map((r, idx) => (
            <button
              key={r.bid_id}
              onClick={() => setActiveReportIdx(idx)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border border-b-0 ${
                idx === activeReportIdx
                  ? 'bg-gray-100 text-gray-900 border-gray-200 shadow-sm'
                  : 'bg-transparent text-gray-400 border-transparent hover:bg-gray-800 hover:text-gray-200'
              }`}
            >
              {r.bidder_name}
            </button>
          ))}
        </div>
      )}
      <div className="flex-1 overflow-hidden">
        <BidDashboard key={activeReport?.bid_id} data={activeReport} bidderName={activeReport?.bidder_name} />
      </div>
    </div>
  );
}
