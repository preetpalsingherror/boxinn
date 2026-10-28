'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Dumbbell, ShieldAlert, ArrowRight, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to log in. Please check your credentials.');
      }

      if (data.data.user.role === 'ADMIN') {
        try {
          sessionStorage.removeItem('boxinn_member_session');
          sessionStorage.setItem(
            'boxinn_admin_session',
            JSON.stringify({ role: 'ADMIN', fullName: data.data.user.fullName || 'Admin' })
          );
        } catch {}
        router.push('/admin');
      } else {
        try {
          sessionStorage.removeItem('boxinn_admin_session');
          sessionStorage.setItem(
            'boxinn_member_session',
            JSON.stringify({ role: 'MEMBER', fullName: data.data.user.fullName || '' })
          );
        } catch {}
        router.push('/home');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid login attempt.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col justify-center items-center px-4 py-8 bg-[#0A0B0E]">
      <div className="w-full max-w-md bg-[#14171F] border border-[#2A303C] rounded-2xl p-6 sm:p-8 shadow-2xl">
        {/* Brand Header with Official Logo */}
        <div className="flex flex-col items-center mb-6">
          <img 
            src="/brand/boxinn-stacked-dark.png" 
            alt="BOX INN - Rise Above The Average" 
            className="h-24 w-auto mb-2 object-contain filter drop-shadow-[0_2px_12px_rgba(202,218,3,0.25)]" 
          />
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1D222E] border border-[#CADA03]/30 text-[10px] font-black uppercase tracking-widest text-[#CADA03] mt-1">
            Member Companion Portal
          </div>
          <p className="text-xs text-[#94A3B8] mt-2 text-center">
            Private companion for enrolled athletes in Yelahanka, Bengaluru.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-3.5 bg-red-950/40 border border-red-500/40 rounded-xl flex items-start gap-3 text-red-200 text-sm">
            <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 leading-snug">{error}</div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
              Registered Email or Username
            </label>
            <input
              type="text"
              required
              autoCapitalize="none"
              autoCorrect="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. preet or athlete@boxinn.local"
              className="w-full px-4 py-3 bg-[#0A0B0E] border border-[#2A303C] focus:border-[#CADA03] rounded-xl text-[#F8F9FA] placeholder-[#94A3B8]/40 outline-none transition text-sm"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-[#CADA03] hover:underline font-semibold"
              >
                Forgot?
              </Link>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-4 py-3 bg-[#0A0B0E] border border-[#2A303C] focus:border-[#CADA03] rounded-xl text-[#F8F9FA] placeholder-[#94A3B8]/40 outline-none transition text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 bg-[#CADA03] hover:bg-[#B8C702] active:scale-[0.99] text-[#0A0B0E] font-black rounded-xl flex items-center justify-center gap-2 transition shadow-[0_4px_16px_rgba(202,218,3,0.3)] disabled:opacity-60 text-sm tracking-wide uppercase"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-[#0A0B0E]" />
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <span>Enter Companion</span>
                <ArrowRight className="w-4 h-4 text-[#0A0B0E]" />
              </>
            )}
          </button>
        </form>

        {/* Activation Link */}
        <div className="mt-8 pt-6 border-t border-[#2A303C] text-center">
          <p className="text-xs text-[#94A3B8]">
            Received an invitation link from gym administration?
          </p>
          <Link
            href="/activate"
            className="inline-block mt-2 text-xs font-bold text-[#CADA03] hover:underline uppercase tracking-wider"
          >
            Claim Member Invitation →
          </Link>
        </div>
      </div>
    </main>
  );
}
