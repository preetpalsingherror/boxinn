'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Dumbbell, ShieldAlert, CheckCircle2, ArrowRight, Loader2, RefreshCw } from 'lucide-react';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resend state
  const [resendEmail, setResendEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  useEffect(() => {
    const queryToken = searchParams.get('token');
    if (queryToken) {
      setToken(queryToken);
      performVerification(queryToken);
    }
  }, [searchParams]);

  const performVerification = async (verifyToken: string) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: verifyToken }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Verification link is invalid or has expired.');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/home');
        router.refresh();
      }, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Email verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (token) {
      performVerification(token);
    }
  };

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail) return;

    setResending(true);
    try {
      const res = await fetch('/api/auth/verification/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resendEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to resend verification.');
      }
      setResendSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to resend.');
    } finally {
      setResending(false);
    }
  };

  if (success) {
    return (
      <div className="w-full max-w-md bg-[#14171F] border border-emerald-500/40 rounded-2xl p-8 shadow-2xl text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-950/60 border border-emerald-500/40 mx-auto flex items-center justify-center text-emerald-400 mb-4 animate-bounce">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-[#F8F9FA] mb-2">
          Account Activated!
        </h1>
        <p className="text-sm text-[#94A3B8] mb-6">
          Your email has been verified and your member session is active. Redirecting to your companion dashboard...
        </p>
        <Link
          href="/home"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#CADA03] hover:bg-[#B8C702] text-[#0A0B0E] font-black rounded-xl text-sm transition uppercase"
        >
          <span>Open Dashboard</span>
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
          Verify Email
        </h1>
        <p className="text-xs text-[#94A3B8] mt-1">
          Confirm your email to complete companion activation.
        </p>
      </div>

      {loading && (
        <div className="py-8 flex flex-col items-center justify-center text-center">
          <Loader2 className="w-10 h-10 text-[#CADA03] animate-spin mb-3" />
          <p className="text-sm text-[#94A3B8]">Validating your single-use verification token...</p>
        </div>
      )}

      {error && !loading && (
        <div className="mb-6 p-4 bg-red-950/40 border border-red-500/40 rounded-xl text-red-200 text-sm">
          <div className="flex items-start gap-3 mb-2">
            <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="font-semibold">{error}</div>
          </div>
          <p className="text-xs text-red-300/80 leading-relaxed">
            The verification token may have expired (valid for 24h) or has already been consumed. Request a fresh verification link below.
          </p>
        </div>
      )}

      {!loading && !success && (
        <>
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                Verification Token
              </label>
              <input
                type="text"
                required
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste token from verification email"
                className="w-full px-4 py-3 bg-[#0A0B0E] border border-[#2A303C] focus:border-[#CADA03] rounded-xl text-[#F8F9FA] placeholder-[#94A3B8]/40 outline-none text-sm font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !token}
              className="w-full py-3.5 px-4 bg-[#CADA03] hover:bg-[#B8C702] text-[#0A0B0E] font-black rounded-xl flex items-center justify-center gap-2 transition text-sm disabled:opacity-50 uppercase"
            >
              Verify & Activate Account
            </button>
          </form>

          {/* Resend Section */}
          <div className="mt-8 pt-6 border-t border-[#2A303C]">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8] mb-3">
              Need a new verification link?
            </h3>
            {resendSuccess ? (
              <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-xs text-emerald-300">
                A fresh verification link has been sent if an unverified account exists.
              </div>
            ) : (
              <form onSubmit={handleResend} className="space-y-3">
                <input
                  type="email"
                  required
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  placeholder="Enter your registered email"
                  className="w-full px-3.5 py-2.5 bg-[#0A0B0E] border border-[#2A303C] focus:border-[#FF5500] rounded-xl text-[#F8F9FA] placeholder-[#94A3B8]/40 outline-none text-xs"
                />
                <button
                  type="submit"
                  disabled={resending || !resendEmail}
                  className="w-full py-2.5 px-3 bg-[#1D222E] hover:bg-[#2A303C] text-xs font-semibold text-[#F8F9FA] rounded-xl flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                >
                  {resending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  <span>Resend Verification Email</span>
                </button>
              </form>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <main className="min-h-screen flex flex-col justify-center items-center px-4 py-8 bg-[#0A0B0E]">
      <Suspense fallback={<div className="text-muted text-sm">Processing verification...</div>}>
        <VerifyEmailContent />
      </Suspense>
    </main>
  );
}
