import React, { useState } from 'react';

const LoginDashboard = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(null);

  const Modal = ({ title, content, onClose }) => (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col text-left">
        <div className="flex items-center justify-between p-4 border-b border-outline-variant">
          <h2 className="font-headline-sm text-lg font-bold text-primary">{title}</h2>
          <button onClick={onClose} className="text-on-surface-variant hover:text-error transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="p-6 overflow-y-auto text-sm text-on-surface whitespace-pre-wrap leading-relaxed">
          {content}
        </div>
        <div className="p-4 border-t border-outline-variant bg-surface-container-low flex justify-end rounded-b-xl">
          <button onClick={onClose} className="px-4 py-2 bg-primary text-on-primary rounded font-medium hover:bg-on-surface-variant transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Fixed mock credentials
    if (username === 'admin' && password === 'admin123') {
      setTimeout(() => {
        onLogin({
          name: 'Demo User',
          role: 'Administrator',
          department: 'Operations',
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
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden shadow-sm mb-4">
            <img src="/favicon.svg" alt="Vecta Logo" className="w-full h-full object-cover" />
          </div>
          <h1 className="font-headline-lg text-2xl font-bold tracking-tight text-on-surface">Log in to Vecta</h1>
          <h2 className="text-sm text-on-surface-variant mt-2">
            Enter your details below to continue
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <div className="bg-error-container text-on-error-container p-3 rounded-md text-sm text-center">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-on-surface font-medium">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-surface-container-lowest border border-outline-variant rounded-md py-2 px-3 text-on-surface focus:border-outline focus:ring-1 focus:ring-outline focus:outline-none transition-all shadow-sm"
              placeholder="admin"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-on-surface font-medium">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-surface-container-lowest border border-outline-variant rounded-md py-2 px-3 text-on-surface focus:border-outline focus:ring-1 focus:ring-outline focus:outline-none transition-all shadow-sm"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="mt-2 w-full bg-primary hover:bg-on-surface-variant text-on-primary font-medium py-2.5 rounded-md flex items-center justify-center transition-all shadow-sm disabled:opacity-70"
          >
            {isLoading ? (
              <span className="w-5 h-5 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin"></span>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-xs text-on-surface-variant">
            By logging in, you agree to our{' '}
            <button type="button" onClick={() => setShowModal('tos')} className="text-primary hover:underline font-medium">Terms of Service</button>
            {' '}and{' '}
            <button type="button" onClick={() => setShowModal('privacy')} className="text-primary hover:underline font-medium">Privacy Policy</button>.
          </p>
        </div>
      </div>

      {showModal === 'tos' && (
        <Modal 
          title="Terms of Service" 
          content="This is a placeholder for the Vecta Terms of Service.\n\n1. Acceptance of Terms\nBy accessing this software, you agree to be bound by these terms. If you disagree with any part of the terms, you may not access the service.\n\n2. Use License\nPermission is granted to temporarily use the software for evaluation purposes. This is the grant of a license, not a transfer of title.\n\n3. Disclaimer\nThe materials on Vecta's software are provided on an 'as is' basis. Vecta makes no warranties, expressed or implied.\n\n4. Limitations\nIn no event shall Vecta or its suppliers be liable for any damages arising out of the use or inability to use the materials on the software."
          onClose={() => setShowModal(null)} 
        />
      )}
      {showModal === 'privacy' && (
        <Modal 
          title="Privacy Policy" 
          content="This is a placeholder for the Vecta Privacy Policy.\n\n1. Information Collection\nWe collect information to provide better services to all our users. We only collect information necessary to provide you with the service.\n\n2. Use of Information\nYour information is used solely for the purpose of identifying you within the application and improving our service.\n\n3. Data Security\nWe implement robust, industry-standard security measures to protect your data from unauthorized access, alteration, disclosure, or destruction.\n\n4. Third Parties\nWe do not share your personal information with companies, organizations, or individuals outside of Vecta without your explicit consent."
          onClose={() => setShowModal(null)} 
        />
      )}
    </div>
  );
};

export default LoginDashboard;
