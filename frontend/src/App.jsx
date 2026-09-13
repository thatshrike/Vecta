import React, { useState } from 'react';
import UploadDashboard from './UploadDashboard';
import ResultsDashboard from './ResultsDashboard';
import LoginDashboard from './LoginDashboard';

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('upload'); // 'upload' | 'results'
  const [reports, setReports] = useState([]);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const handleAnalysisComplete = (newReports) => {
    setReports(newReports);
    setView('results');
  };

  const handleLogout = () => {
    setUser(null);
    setReports([]);
    setView('upload');
  };

  if (!user) {
    return <LoginDashboard onLogin={setUser} />;
  }

  return (
    <div className="bg-background font-body-md text-on-surface min-h-screen">
      {/* Global Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-primary shadow-[0_1px_8px_rgba(0,0,0,0.18)] border-b border-amber-900/30">
        <div className="h-16 w-full flex flex-col justify-between">
          <div className="h-16 px-gutter flex items-center justify-between bg-primary-container w-full">
            <div className="flex items-center gap-space-lg">
              <div className="flex items-center gap-space-sm">
                <img src="/logo.svg" alt="Vecta" className="w-10 h-10 drop-shadow-md" />
                <div>
                  <div className="font-headline-sm text-headline-sm text-on-primary font-bold tracking-tight">VECTA GeM Enclave</div>
                  <div className="font-mono-data-sm text-mono-data-sm text-amber-200/70">Technical Evaluation Committee (TEC) Workspace</div>
                </div>
              </div>
              {/* Hide static tender details if not in results view */}
              {view === 'results' && reports.length > 0 && (
                <div className="hidden 2xl:flex items-center gap-space-md pl-space-lg border-l border-stone-700">
                  <div className="flex flex-col">
                    <span className="font-mono-data-sm text-mono-data-sm text-stone-400 uppercase">Active Tender</span>
                    <span className="font-mono-data text-mono-data text-amber-300 font-semibold">{reports[0].tender_requirements?.[0]?.clause_id || "Active"}</span>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-6">
              <button disabled className="hidden md:flex items-center gap-space-xs px-space-md py-space-xs bg-stone-800 text-amber-100 border border-amber-700/40 rounded font-body-sm text-body-sm font-semibold opacity-40 cursor-not-allowed select-none" title="Coming in future release">
                <span className="material-symbols-outlined text-[16px]">download</span>Export Report (PDF)
              </button>

              {/* User Profile */}
              <div className="relative">
                <button 
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center gap-3 hover:bg-stone-800 p-1.5 rounded transition-colors focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <div className="text-right hidden sm:block">
                    <div className="font-body-sm text-[13px] text-on-primary font-bold">{user.name}</div>
                    <div className="font-mono-data-sm text-[10px] text-amber-200/70">{user.role}</div>
                  </div>
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-600 to-amber-800 border-2 border-amber-500/30 flex items-center justify-center text-white font-bold shadow-inner">
                    {user.name.charAt(0)}
                  </div>
                  <span className="material-symbols-outlined text-stone-400 text-[18px]">
                    arrow_drop_down
                  </span>
                </button>

                {showProfileMenu && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-surface-container-low border border-outline-variant shadow-xl rounded-lg overflow-hidden py-1 z-50">
                    <div className="px-4 py-3 border-b border-outline-variant bg-surface-container-lowest">
                      <p className="text-sm font-bold text-primary">{user.name}</p>
                      <p className="text-xs text-on-surface-variant font-mono-data-sm mt-0.5">@{user.username}</p>
                      <div className="mt-2 inline-flex items-center gap-1 bg-amber-100 text-amber-900 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider">
                        <span className="material-symbols-outlined text-[12px]">security</span>
                        {user.department} Clearance
                      </div>
                    </div>
                    <button 
                      className="w-full text-left px-4 py-2 text-sm text-primary hover:bg-surface-container-high transition-colors flex items-center gap-2"
                      onClick={() => setShowProfileMenu(false)}
                    >
                      <span className="material-symbols-outlined text-[18px]">person</span>
                      View Profile
                    </button>
                    <button 
                      className="w-full text-left px-4 py-2 text-sm text-error hover:bg-error/10 transition-colors flex items-center gap-2"
                      onClick={handleLogout}
                    >
                      <span className="material-symbols-outlined text-[18px]">logout</span>
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Global Sidebar */}
      <aside className="fixed left-0 top-16 bottom-0 w-64 bg-surface-container-low z-40 flex flex-col justify-between py-space-md border-r border-outline-variant">
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
        <main className="relative pt-16 w-full bg-background min-h-screen">
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
