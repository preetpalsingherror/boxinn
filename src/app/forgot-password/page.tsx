'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Dumbbell, ShieldAlert, CheckCircle2, ArrowRight, Loader2, ArrowLeft } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to process password reset request.');
      }
      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Request failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col justify-center items-center px-4 py-8 bg-[#0A0B0E]">
      <div className="w-full max-w-md bg-[#14171F] border border-[#2A303C] rounded-2xl p-6 sm:p-8 shadow-2xl">
        <div className="flex flex-col items-center mb-6 text-center">
          <img 
            src="/brand/boxinn-stacked-dark.png" 
            alt="BOX INN - Rise Above The Average" 
            className="h-20 w-auto mb-2 object-contain filter drop-shadow-[0_2px_12px_rgba(202,218,3,0.2)]" 
          />
          <h1 className="text-xl font-black tracking-wider text-[#F8F9FA] uppercase mt-1">
            Reset Password
          </h1>
          <p className="text-xs text-[#94A3B8] mt-1">
            Enter your enrolled email to receive recovery instructions.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3.5 bg-red-950/40 border border-red-500/40 rounded-xl flex items-start gap-3 text-red-200 text-sm">
            <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 leading-snug">{error}</div>
          </div>
        )}

        {submitted ? (
          <div className="text-center py-4 space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-950/60 border border-emerald-500/40 mx-auto flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <p className="text-sm text-[#94A3B8] leading-relaxed">
              If an account is associated with that email, a password reset link has been dispatched. Please check your inbox (valid for 1 hour).
            </p>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-1.5 text-sm font-bold text-[#CADA03] hover:underline uppercase"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Log In</span>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                Registered Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="athlete@boxinn.local"
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
                  <span>Dispatching Link...</span>
                </>
              ) : (
                <>
                  <span>Send Reset Instructions</span>
                  <ArrowRight className="w-4 h-4 text-[#0A0B0E]" />
                </>
              )}
            </button>

            <div className="pt-4 text-center">
              <Link
                href="/login"
                className="text-xs text-[#94A3B8] hover:text-[#F8F9FA] inline-flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Log In
              </Link>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
