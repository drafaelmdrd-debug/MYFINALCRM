import React, { useState } from 'react';
import { Building2, Lock, Mail, AlertCircle } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { isSupabaseConfigured } from '../lib/supabase';

export function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error: signInError } = await signIn(email.trim(), password);
    setSubmitting(false);
    if (signInError) {
      setError(signInError);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F6F1] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-[#B85338] text-white flex items-center justify-center shadow-sm mb-3">
            <Building2 className="w-6 h-6" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-lg tracking-tight text-[#1F2421]">GroundWork</span>
            <span className="text-[10px] font-mono font-bold bg-[#B85338]/10 text-[#B85338] px-1.5 py-0.5 rounded">
              CRM
            </span>
          </div>
          <p className="text-xs text-[#5E6660] mt-1">Sign in to access the shared workspace</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white border border-[#E4E0D6] rounded-xl shadow-sm p-6 flex flex-col gap-4"
        >
          {!isSupabaseConfigured && (
            <div className="flex items-start gap-2 text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Supabase isn't configured yet. Set <code>VITE_SUPABASE_URL</code> and{' '}
                <code>VITE_SUPABASE_ANON_KEY</code> in your environment.
              </span>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-[#1F2421] mb-1 block">Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#5E6660] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-[#F8F6F1] border border-[#E4E0D6] focus:border-[#B85338] focus:bg-white text-sm text-[#1F2421] rounded-lg pl-9 pr-3 py-2 outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-[#1F2421] mb-1 block">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#5E6660] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#F8F6F1] border border-[#E4E0D6] focus:border-[#B85338] focus:bg-white text-sm text-[#1F2421] rounded-lg pl-9 pr-3 py-2 outline-none transition-all"
              />
            </div>
          </div>

          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#B85338] hover:bg-[#a3452e] disabled:opacity-60 text-white text-sm font-semibold rounded-lg py-2.5 transition-colors"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="text-[11px] text-[#5E6660] text-center">
            Accounts are created by an admin in the Supabase dashboard. Contact whoever set up the
            workspace if you need one.
          </p>
        </form>
      </div>
    </div>
  );
}
