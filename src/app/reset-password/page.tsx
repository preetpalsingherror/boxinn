'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Dumbbell, ShieldAlert, CheckCircle2, ArrowRight, Loader2 } from 'lucide-react';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const queryToken = searchParams.get('token');
    if (queryToken) {
      setToken(queryToken);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Password reset failed.');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Password reset failed.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="w-full max-w-md bg-[#14171F] border border-emerald-500/40 rounded-2xl p-8 shadow-2xl text-center">
        <div className="w-14 h-14 rounded-full bg-emerald-950/60 border border-emerald-500/40 mx-auto flex items-center justify-center text-emerald-400 mb-4">
          <CheckCircle2 className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-[#F8F9FA] mb-2">
          Password Updated!
        </h2>
        <p className="text-sm text-[#94A3B8] mb-6">
          Your password has been securely reset, and active sessions on other devices were revoked. Redirecting to login...
        </p>
        <Link
          href="/login"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#CADA03] hover:bg-[#B8C702] text-[#0A0B0E] font-black rounded-xl text-sm transition uppercase"
        >
          <span>Log In Now</span>
          <ArrowRight className="w-4 h-4 text-[#0A0B0E]" />
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md bg-[#14171F] border border-[#2A303C] rounded-2xl p-6 sm:p-8 shadow-2xl">
      <div className="flex flex-col items-center mb-6 text-center">
        <img 
          src="/brand/boxinn-stacked-dark.png" 
          alt="BOX INN - Rise Above The Average" 
          className="h-20 w-auto mb-2 object-contain filter drop-shadow-[0_2px_12px_rgba(202,218,3,0.2)]" 
        />
        <h1 className="text-xl font-black tracking-wider text-[#F8F9FA] uppercase mt-1">
          Set New Password
        </h1>
        <p className="text-xs text-[#94A3B8] mt-1">
          Enter your recovery token and new credentials.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-3.5 bg-red-950/40 border border-red-500/40 rounded-xl flex items-start gap-3 text-red-200 text-sm">
          <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1 leading-snug">{error}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
            Reset Token
          </label>
          <input
            type="text"
            required
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Paste token from reset email"
            className="w-full px-4 py-3 bg-[#0A0B0E] border border-[#2A303C] focus:border-[#CADA03] rounded-xl text-[#F8F9FA] placeholder-[#94A3B8]/40 outline-none text-sm font-mono"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
            New Password
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min 8 chars, upper, lower, symbol"
            className="w-full px-4 py-3 bg-[#0A0B0E] border border-[#2A303C] focus:border-[#CADA03] rounded-xl text-[#F8F9FA] placeholder-[#94A3B8]/40 outline-none text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
            Confirm New Password
          </label>
          <input
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter password"
            className="w-full px-4 py-3 bg-[#0A0B0E] border border-[#2A303C] focus:border-[#CADA03] rounded-xl text-[#F8F9FA] placeholder-[#94A3B8]/40 outline-none text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 px-4 bg-[#CADA03] hover:bg-[#B8C702] text-[#0A0B0E] font-black rounded-xl flex items-center justify-center gap-2 transition text-sm disabled:opacity-60 uppercase"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin text-[#0A0B0E]" />
              <span>Resetting Password...</span>
            </>
          ) : (
            <span>Update Password</span>
          )}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen flex flex-col justify-center items-center px-4 py-8 bg-[#0A0B0E]">
      <Suspense fallback={<div className="text-muted text-sm">Loading reset form...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </main>
  );
}
