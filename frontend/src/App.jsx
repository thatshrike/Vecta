import React, { useState, useEffect } from 'react';
import UploadDashboard from './UploadDashboard';
import ResultsDashboard from './ResultsDashboard';
import LoginDashboard from './LoginDashboard';

export default function App() {
  // Restore session from sessionStorage on mount so back-navigation doesn't force re-login
  const [user, setUser] = useState(() => {
    try {
      const stored = sessionStorage.getItem('vecta_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [view, setView] = useState('upload'); // 'upload' | 'results'
  const [reports, setReports] = useState([]);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Keep sessionStorage in sync whenever user changes
  useEffect(() => {
    if (user) {
      sessionStorage.setItem('vecta_user', JSON.stringify(user));
    } else {
      sessionStorage.removeItem('vecta_user');
    }
  }, [user]);

  // Close profile menu when clicking outside
  useEffect(() => {
    if (!showProfileMenu) return;
    const close = () => setShowProfileMenu(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [showProfileMenu]);

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
        <div className="h-16 w-full">
          <div className="h-16 px-gutter flex items-center justify-between bg-primary-container w-full">
            <div className="flex items-center gap-space-lg">
              <div className="flex items-center gap-space-sm">
                <img src="/logo.svg" alt="Vecta" className="w-10 h-10 drop-shadow-md" />
                <div>
                  <div className="font-headline-sm text-headline-sm text-on-primary font-bold tracking-tight">VECTA GeM Enclave</div>
                  <div className="font-mono-data-sm text-mono-data-sm text-amber-200/70">Technical Evaluation Committee (TEC) Workspace</div>
                </div>
              </div>
              {/* Active tender badge — only visible in results view on wide screens */}
              {view === 'results' && reports.length > 0 && (
                <div className="hidden 2xl:flex items-center gap-space-md pl-space-lg border-l border-stone-700">
                  <div className="flex flex-col">
                    <span className="font-mono-data-sm text-mono-data-sm text-stone-400 uppercase">Active Tender</span>
                    <span className="font-mono-data text-mono-data text-amber-300 font-semibold">{reports[0].tender_requirements?.[0]?.clause_id || "Active"}</span>
                  </div>
                </div>
              )}
            </div>

            {/* User Profile */}
            <div className="relative" onClick={(e) => e.stopPropagation()}>
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
      </header>

      {/* Global Sidebar */}
      <aside className="fixed left-0 top-16 bottom-10 w-64 bg-surface-container-low z-40 flex flex-col justify-between py-space-md border-r border-outline-variant">
        <div className="flex flex-col">
          <div className="px-space-md pb-space-sm border-b border-outline-variant mb-space-xs">
            <div className="font-label-caps text-label-caps text-on-surface-variant uppercase">Verification Rail</div>
            <div className="font-body-sm text-body-sm font-semibold text-primary">Workspace</div>
          </div>
          <nav className="flex flex-col gap-1 px-space-xs">
            <a
              aria-current={view === 'upload' ? 'page' : undefined}
              onClick={(e) => { e.preventDefault(); setView('upload'); }}
              className={`px-space-md py-space-sm rounded transition-all cursor-pointer ${view === 'upload' ? 'bg-primary text-on-primary font-semibold shadow-[0_1px_4px_rgba(0,0,0,0.06)] border-l-4 border-amber-500' : 'font-body-sm text-body-sm text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'}`}
            >
              Workspace
            </a>
            <a
              aria-current={view === 'results' ? 'page' : undefined}
              onClick={(e) => { e.preventDefault(); if (reports.length > 0) setView('results'); }}
              className={`px-space-md py-space-sm rounded transition-all ${view === 'results' ? 'bg-primary text-on-primary font-semibold shadow-[0_1px_4px_rgba(0,0,0,0.06)] border-l-4 border-amber-500' : 'font-body-sm text-body-sm text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'} ${reports.length === 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              Evaluation Result
            </a>
          </nav>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="pl-64 pb-10">
        <main className="relative pt-16 w-full bg-background min-h-[calc(100vh-2.5rem)] flex flex-col">
          <div className="flex-1">
            {view === 'upload' ? (
              <UploadDashboard onComplete={handleAnalysisComplete} />
            ) : (
              <ResultsDashboard reports={reports} />
            )}
          </div>
        </main>
      </div>

      {/* Global Footer */}
      <footer className="fixed bottom-0 left-0 right-0 h-10 z-50 bg-primary border-t border-amber-900/30 px-gutter flex items-center justify-between text-amber-200/70 font-mono-data-sm text-[11px]">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[14px]">shield</span>
          <span>VECTA GeM Enclave • Secure Technical Evaluation Workspace</span>
        </div>
        <div className="flex items-center gap-4">
          <span>v1.0.0 (AI Bid Intelligence Engine)</span>
          <span>&copy; {new Date().getFullYear()} Government of India</span>
        </div>
      </footer>
    </div>
  );
}
