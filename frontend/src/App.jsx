import React, { useState } from 'react';
import UploadDashboard from './UploadDashboard';
import BidDashboard from './BidDashboard';

export default function App() {
  const [view, setView] = useState('upload'); // 'upload' | 'results'
  const [analyzedBidders, setAnalyzedBidders] = useState([]);

  const handleAnalysisComplete = (bidders) => {
    setAnalyzedBidders(bidders);
    setView('results');
  };

  if (view === 'upload') {
    return <UploadDashboard onComplete={handleAnalysisComplete} />;
  }

  // We pass the derived name of the first uploaded bidder, or default to ABC if empty
  const activeBidderName = analyzedBidders.length > 0 ? analyzedBidders[0].derivedName : null;

  return <BidDashboard bidderName={activeBidderName} />;
}
