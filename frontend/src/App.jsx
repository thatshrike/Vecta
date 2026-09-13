import React, { useState } from 'react';
import UploadDashboard from './UploadDashboard';
import ResultsDashboard from './ResultsDashboard';
import LoginDashboard from './LoginDashboard';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [view, setView] = useState('upload'); // 'upload' | 'results'
  const [reports, setReports] = useState([]);

  const handleAnalysisComplete = (newReports) => {
    setReports(newReports);
    setView('results');
  };

  if (!isAuthenticated) {
    return <LoginDashboard onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="bg-background font-body-md text-on-surface min-h-screen">
      {/* Global Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-primary shadow-[0_1px_8px_rgba(0,0,0,0.18)] border-b border-amber-900/30">
        <div className="h-28 w-full flex flex-col justify-between">
          <div className="h-11 px-gutter flex items-center justify-between border-b border-stone-700/40">
            <div className="flex items-center gap-space-md">
              <div className="flex items-center gap-space-xs">
                <span className="font-label-caps text-label-caps uppercase text-amber-200/80">GOVERNMENT OF INDIA</span>
                <span className="text-stone-600 text-mono-data-sm">|</span>
                <span className="font-body-sm text-body-sm text-stone-300">Ministry of Commerce &amp; Industry</span>
              </div>
            </div>
            <div className="flex items-center gap-space-xs">
              <button className="px-space-xs py-[2px] rounded bg-amber-700 font-label-caps text-label-caps uppercase text-on-primary font-bold">EN</button>
              <span className="text-stone-600 text-mono-data-sm">/</span>
              <button className="px-space-xs py-[2px] rounded font-label-caps text-label-caps uppercase text-stone-400 hover:text-on-primary">हिन्दी</button>
            </div>
          </div>
          <div className="h-16 px-gutter flex items-center justify-between bg-primary-container">
            <div className="flex items-center gap-space-lg">
              <div className="flex items-center gap-space-sm">
                <div className="w-10 h-10 flex items-center justify-center">
                  <img src="/logo.svg" alt="Vecta Platform Logo" className="w-full h-full drop-shadow-md" />
                </div>
                <div>
                  <div className="font-headline-sm text-headline-sm text-on-primary font-bold tracking-tight">AI Bid Intelligence & Technical Evaluation</div>
                  <div className="font-mono-data-sm text-mono-data-sm text-amber-200/70">GeM 4.0 Institutional Enclave • Technical Evaluation Committee (TEC) Workspace</div>
                </div>
              </div>
              {/* Hide static tender details if not in results view, or we can leave it if we want to pretend it's a fixed workspace */}
              {view === 'results' && reports.length > 0 && (
                <div className="hidden 2xl:flex items-center gap-space-md pl-space-lg border-l border-stone-700">
                  <div className="flex flex-col">
                    <span className="font-mono-data-sm text-mono-data-sm text-stone-400 uppercase">Active Tender</span>
                    <span className="font-mono-data text-mono-data text-amber-300 font-semibold">{reports[0].tender_requirements?.[0]?.clause_id || "Active"}</span>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-space-sm">
              <button disabled className="flex items-center gap-space-xs px-space-md py-space-xs bg-stone-800 text-amber-100 border border-amber-700/40 rounded font-body-sm text-body-sm font-semibold opacity-40 cursor-not-allowed select-none" title="Coming in future release">
                <span className="material-symbols-outlined text-[16px]">download</span>Export Report (PDF)
              </button>
            </div>
          </div>
          <div className="h-[3px] w-full flex">
            <div className="w-1/3 h-full bg-[#ff9933]"></div>
            <div className="w-1/3 h-full bg-[#ffffff]"></div>
            <div className="w-1/3 h-full bg-[#138808]"></div>
          </div>
        </div>
      </header>

      {/* Global Sidebar */}
      <aside className="fixed left-0 top-28 bottom-0 w-64 bg-surface-container-low z-40 flex flex-col justify-between py-space-md border-r border-outline-variant">
        <div className="flex flex-col">
          <div className="px-space-md pb-space-sm border-b border-outline-variant mb-space-xs">
            <div className="font-label-caps text-label-caps text-on-surface-variant uppercase">Verification Rail</div>
            <div className="font-body-sm text-body-sm font-semibold text-primary">Workspace</div>
          </div>
          <nav className="flex flex-col gap-1 px-space-xs">
            <a aria-current={view === 'upload' ? 'page' : undefined} onClick={(e) => { e.preventDefault(); setView('upload'); }} className={`px-space-md py-space-sm rounded transition-all ${view === 'upload' ? 'bg-primary text-on-primary font-semibold shadow-[0_1px_4px_rgba(0,0,0,0.06)] border-l-4 border-amber-500' : 'font-body-sm text-body-sm text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'} cursor-pointer`}>Ingestion Workspace</a>
            <a aria-current={view === 'results' ? 'page' : undefined} onClick={(e) => { e.preventDefault(); if (reports.length > 0) setView('results'); }} className={`px-space-md py-space-sm rounded transition-all ${view === 'results' ? 'bg-primary text-on-primary font-semibold shadow-[0_1px_4px_rgba(0,0,0,0.06)] border-l-4 border-amber-500' : 'font-body-sm text-body-sm text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'} ${reports.length === 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>Clause Evaluation Matrix</a>
            <div className="px-space-md py-space-sm rounded font-body-sm text-body-sm text-on-surface-variant opacity-40 cursor-not-allowed select-none" title="Coming in future release">
              More features coming soon
            </div>
          </nav>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="pl-64">
        <main className="relative pt-28 w-full bg-background min-h-screen">
          {view === 'upload' ? (
            <UploadDashboard onComplete={handleAnalysisComplete} />
          ) : (
            <ResultsDashboard reports={reports} />
          )}
        </main>
      </div>
    </div>
  );
}
