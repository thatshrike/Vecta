import React, { useState } from 'react';

export default function LoginDashboard({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    // Fixed frontend-only credentials
    if (username === 'admin' && password === 'password') {
      setError('');
      onLogin();
    } else {
      setError('Invalid credentials. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center relative overflow-hidden">
      {/* Dynamic Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-background"></div>
      </div>

      <div className="z-10 w-full max-w-md bg-surface-container-low border border-outline-variant p-8 rounded-xl shadow-2xl flex flex-col items-center">
        {/* Logo Integration */}
        <div className="w-24 h-24 mb-6">
          <img src="/logo.svg" alt="Platform Logo" className="w-full h-full drop-shadow-md" />
        </div>

        <h1 className="font-headline-md text-2xl text-primary font-bold tracking-tight mb-2 text-center">
          Vecta Platform
        </h1>
        <p className="font-body-sm text-on-surface-variant text-center mb-8">
          GeM Institutional Procurement <br />
          Technical Evaluation Pipeline
        </p>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="font-label-caps text-[11px] font-bold text-on-surface-variant uppercase">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter 'admin'"
              className="bg-surface-bright border border-outline-variant rounded p-3 font-body-sm text-[14px] text-primary focus:outline-none focus:border-secondary transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-label-caps text-[11px] font-bold text-on-surface-variant uppercase">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter 'password'"
              className="bg-surface-bright border border-outline-variant rounded p-3 font-body-sm text-[14px] text-primary focus:outline-none focus:border-secondary transition-colors"
            />
          </div>

          {error && (
            <div className="mt-2 p-3 rounded bg-error/10 border border-error/20 text-error font-body-sm text-sm">
              <span className="material-symbols-outlined text-[16px] inline-block align-text-bottom mr-1">
                error
              </span>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="mt-4 bg-secondary hover:bg-secondary/90 text-on-primary font-bold py-3 rounded flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            Authenticate <span className="material-symbols-outlined text-[18px]">login</span>
          </button>
        </form>
      </div>

      {/* Government Watermark Footer */}
      <div className="absolute bottom-8 z-10 flex flex-col items-center gap-2 text-center opacity-60">
        <div className="font-label-caps text-[10px] uppercase text-on-surface-variant tracking-widest">
          Government of India
        </div>
        <div className="font-mono-data-sm text-[10px] text-stone-500">
          Secure Access Portal • Authorized Personnel Only
        </div>
      </div>
    </div>
  );
}
