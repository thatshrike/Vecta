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
      <header className="fixed top-0 left-0 right-0 z-50 bg-primary shadow-sm border-b border-primary-container">
        <div className="h-16 w-full">
          <div className="h-16 px-gutter flex items-center justify-between w-full">
            <div className="flex items-center gap-space-lg">
              <div className="flex items-center gap-space-sm">
                <div className="w-8 h-8 rounded-md flex items-center justify-center overflow-hidden">
                  <img src="/favicon.svg" alt="Vecta Logo" className="w-full h-full object-cover" />
                </div>
                <div>
                  <div className="font-headline-sm text-headline-sm text-on-primary font-bold tracking-tight">Vecta</div>
                </div>
              </div>
              {/* Active tender badge — only visible in results view on wide screens */}
              {view === 'results' && reports.length > 0 && (
                <div className="hidden 2xl:flex items-center gap-space-md pl-space-lg border-l border-on-primary/20">
                  <div className="flex flex-col">
                    <span className="font-mono-data-sm text-mono-data-sm text-on-primary/50 uppercase">Active Tender</span>
                    <span className="font-mono-data text-mono-data text-on-primary font-semibold">{reports[0].tender_requirements?.[0]?.clause_id || "Active"}</span>
                  </div>
                </div>
              )}
            </div>

            {/* User Profile */}
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-3 hover:bg-on-primary/10 p-1.5 rounded transition-colors focus:outline-none focus:ring-1 focus:ring-on-primary/50"
              >
                <div className="text-right hidden sm:block">
                  <div className="font-body-sm text-[13px] text-on-primary font-bold">{user.name}</div>
                  <div className="font-mono-data-sm text-[10px] text-on-primary/70">{user.role}</div>
                </div>
                <div className="w-9 h-9 rounded-full bg-on-primary text-primary flex items-center justify-center font-bold shadow-inner">
                  {user.name.charAt(0)}
                </div>
                <span className="material-symbols-outlined text-on-primary/50 text-[18px]">
                  arrow_drop_down
                </span>
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-surface-container-lowest border border-outline-variant shadow-xl rounded-lg overflow-hidden py-1 z-50">
                  <div className="px-4 py-3 border-b border-outline-variant bg-surface-container-low">
                    <p className="text-sm font-bold text-on-surface">{user.name}</p>
                    <p className="text-xs text-on-surface-variant font-mono-data-sm mt-0.5">@{user.username}</p>
                    <div className="mt-2 inline-flex items-center gap-1 bg-surface-container-high text-on-surface px-2 py-0.5 rounded text-[10px] font-bold tracking-wider">
                      <span className="material-symbols-outlined text-[12px]">verified</span>
                      Verified
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
      <aside className="fixed left-0 top-16 bottom-10 w-64 bg-surface-container-lowest z-40 flex flex-col justify-between py-space-md border-r border-outline-variant">
        <div className="flex flex-col">
          <div className="px-space-md pb-space-sm border-b border-outline-variant mb-space-xs">
            <div className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest">Navigation</div>
          </div>
          <nav className="flex flex-col gap-1 px-space-xs">
            <a
              aria-current={view === 'upload' ? 'page' : undefined}
              onClick={(e) => { e.preventDefault(); setView('upload'); }}
              className={`px-space-md py-space-sm rounded transition-all cursor-pointer ${view === 'upload' ? 'bg-surface-container-high text-on-surface font-semibold shadow-sm border-l-4 border-primary' : 'font-body-sm text-body-sm text-on-surface-variant hover:bg-surface-container hover:text-on-surface border-l-4 border-transparent'}`}
            >
              Ingestion
            </a>
            <a
              aria-current={view === 'results' ? 'page' : undefined}
              onClick={(e) => { e.preventDefault(); if (reports.length > 0) setView('results'); }}
              className={`px-space-md py-space-sm rounded transition-all ${view === 'results' ? 'bg-surface-container-high text-on-surface font-semibold shadow-sm border-l-4 border-primary' : 'font-body-sm text-body-sm text-on-surface-variant hover:bg-surface-container hover:text-on-surface border-l-4 border-transparent'} ${reports.length === 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
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
      <footer className="fixed bottom-0 left-0 right-0 h-10 z-50 bg-primary border-t border-primary-container px-gutter flex items-center justify-between text-on-primary/70 font-mono-data-sm text-[11px]">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[14px]">bolt</span>
          <span>&copy; {new Date().getFullYear()} CogBoys</span>
        </div>
        <div className="flex items-center gap-4">
          <span>v1.0.0 (Vecta • Compliance Verification Workspace)</span>
          <a href="#" className="hover:text-on-primary transition-colors">Terms & Conditions</a>
          <a href="#" className="hover:text-on-primary transition-colors">Privacy Policy</a>
        </div>
      </footer>
    </div>
  );
}
