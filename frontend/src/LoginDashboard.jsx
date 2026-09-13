import React, { useState } from 'react';

const LoginDashboard = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Fixed mock credentials
    if (username === 'admin' && password === 'admin123') {
      setTimeout(() => {
        onLogin({
          name: 'Rajesh Verma',
          role: 'Director (Procurement)',
          department: 'MoD',
          username: username
        });
      }, 600); // simulate network delay
    } else {
      setTimeout(() => {
        setIsLoading(false);
        setError('Invalid credentials. Please use admin / admin123');
      }, 600);
    }
  };

  return (
    <div className="min-h-screen bg-[#030811] flex items-center justify-center p-4 relative overflow-hidden text-on-primary">
      {/* Background Ambience */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[100px]" />
      </div>

      <div className="z-10 w-full max-w-md bg-surface-container-low border border-outline-variant/30 rounded-2xl shadow-2xl p-8 backdrop-blur-sm">
        <div className="flex flex-col items-center mb-8">
          <img src="/logo.svg" alt="Vecta Shield" className="w-24 h-24 mb-4 drop-shadow-2xl" />
          <h1 className="font-headline-lg text-2xl font-bold tracking-tight text-secondary">VECTA</h1>
          <h2 className="font-label-caps text-xs tracking-[0.2em] text-on-surface-variant uppercase mt-1">
            GeM Institutional Enclave
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {error && (
            <div className="bg-error/10 border border-error/20 text-error p-3 rounded-md font-body-sm text-sm text-center">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="font-label-caps text-xs text-on-surface-variant uppercase tracking-wider pl-1">
              Govt. Username
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-[18px]">
                person
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-[#081422] border border-outline-variant/30 rounded-lg py-2.5 pl-10 pr-4 text-on-primary font-body-md focus:border-secondary focus:ring-1 focus:ring-secondary/50 focus:outline-none transition-all placeholder:text-on-surface-variant/30"
                placeholder="admin"
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-label-caps text-xs text-on-surface-variant uppercase tracking-wider pl-1">
              Passphrase
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-[18px]">
                lock
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#081422] border border-outline-variant/30 rounded-lg py-2.5 pl-10 pr-4 text-on-primary font-body-md focus:border-secondary focus:ring-1 focus:ring-secondary/50 focus:outline-none transition-all placeholder:text-on-surface-variant/30"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="mt-4 w-full bg-gradient-to-r from-[#d8a340] to-[#b88424] hover:from-[#f3cb75] hover:to-[#c99732] text-[#030811] font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-secondary/20 disabled:opacity-70"
          >
            {isLoading ? (
              <span className="w-5 h-5 border-2 border-[#030811]/30 border-t-[#030811] rounded-full animate-spin"></span>
            ) : (
              <>
                <span className="material-symbols-outlined text-[20px]">login</span>
                Secure Sign-In
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-outline-variant/20 flex flex-col items-center gap-2">
          <div className="flex items-center gap-2 text-on-surface-variant/60 font-mono-data-sm text-[10px]">
            <span className="material-symbols-outlined text-[14px]">shield</span>
            <span>RESTRICTED ACCESS • TIA GRADE A CLEARANCE REQUIRED</span>
          </div>
          <p className="text-[10px] text-on-surface-variant/40 text-center max-w-[280px]">
            Unauthorized access to this portal is strictly prohibited under the Information Technology Act.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginDashboard;
