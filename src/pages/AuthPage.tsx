import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';

export function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (mode === 'signup') {
      if (username.trim().length < 3) {
        setError('Username must be at least 3 characters.');
        setLoading(false);
        return;
      }
      const { error } = await signUp(email, password, username.trim());
      if (error) setError(error);
    } else {
      const { error } = await signIn(email, password);
      if (error) setError(error);
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 relative overflow-hidden">
      {/* glow background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-72 h-72 rounded-full bg-[#00FF88]/15 blur-[120px]" />
        <div className="absolute bottom-1/4 -right-32 w-72 h-72 rounded-full bg-[#0088FF]/15 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-[#00FF88] to-[#0088FF] shadow-lg shadow-[#00FF88]/20">
            <svg viewBox="0 0 24 24" className="w-12 h-12" fill="none" stroke="black" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 4l9 16 9-16" />
            </svg>
          </div>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-white">VERTIQ</h1>
          <p className="mt-2 text-sm text-gray-500">Vertical video. Reinvented.</p>
        </div>

        {/* Tab switcher */}
        <div className="flex mb-6 bg-white/5 rounded-xl p-1">
          <button
            type="button"
            onClick={() => { setMode('login'); setError(null); }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              mode === 'login' ? 'bg-[#00FF88] text-black' : 'text-gray-400 hover:text-white'
            }`}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => { setMode('signup'); setError(null); }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              mode === 'signup' ? 'bg-[#00FF88] text-black' : 'text-gray-400 hover:text-white'
            }`}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:border-[#00FF88] transition-colors"
                required
                minLength={3}
                autoComplete="username"
              />
            </div>
          )}
          <div>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:border-[#00FF88] transition-colors"
              required
              autoComplete="email"
            />
          </div>
          <div>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:border-[#00FF88] transition-colors"
              required
              minLength={6}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            />
          </div>

          {error && (
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-[#00FF88] to-[#0088FF] text-black font-bold py-3.5 rounded-xl transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Please wait…' : mode === 'signup' ? 'Create Account' : 'Log In'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-gray-600">
          By continuing you agree to VERTIQ's Terms of Service.
        </p>
      </div>
    </div>
  );
}
