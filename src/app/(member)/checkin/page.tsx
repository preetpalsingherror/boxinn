'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  QrCode, 
  CheckCircle2, 
  Clock, 
  Flame, 
  ShieldAlert, 
  Loader2, 
  ArrowLeft,
  Calendar
} from 'lucide-react';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '../../../presentation/security/cookie-constants.ts';

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
  return match ? decodeURIComponent(match[3]) : null;
}

export default function CheckInPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    isDuplicate: boolean;
    message: string;
    gymDate: string;
    checkInTime: string;
    streak?: { currentStreak: number; longestStreak: number };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleCheckIn = async () => {
    setLoading(true);
    setError(null);

    try {
      const csrfToken = getCookie(CSRF_COOKIE_NAME) || '';

      const res = await fetch('/api/attendance/check-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [CSRF_HEADER_NAME]: csrfToken,
        },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Check-in failed.');
      }

      setResult(data.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Check-in error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/home"
          className="p-2 -ml-2 text-[#94A3B8] hover:text-[#F8F9FA] rounded-lg transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="text-center">
          <h1 className="text-lg font-black tracking-wider uppercase text-[#F8F9FA]">
            Facility Check-In
          </h1>
          <p className="text-[11px] text-[#94A3B8]">Asia/Kolkata • {currentTime || 'Loading...'}</p>
        </div>
        <div className="w-9"></div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-red-950/40 border border-red-500/40 rounded-2xl flex items-start gap-3 text-red-200 text-sm shadow-xl">
          <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">{error}</div>
        </div>
      )}

      {/* Result Display */}
      {result ? (
        <div className="bg-[#14171F] border border-[#2A303C] rounded-2xl p-6 shadow-2xl text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-950/60 border border-emerald-500/40 mx-auto flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-[#F8F9FA]">
              {result.isDuplicate ? 'Visit Already Logged Today' : 'Check-In Confirmed!'}
            </h2>
            <p className="text-xs text-[#94A3B8] mt-1.5 leading-relaxed max-w-xs mx-auto">
              {result.message}
            </p>
          </div>

          {result.streak && (
            <div className="p-4 bg-[#1D222E] rounded-xl border border-[#2A303C] flex items-center justify-around text-center">
              <div>
                <div className="text-xs text-[#94A3B8] uppercase tracking-wider font-semibold">
                  Current Streak
                </div>
                <div className="text-2xl font-black text-[#CADA03] flex items-center justify-center gap-1 mt-0.5">
                  <Flame className="w-5 h-5 text-[#CADA03]" />
                  <span>{result.streak.currentStreak} Days</span>
                </div>
              </div>
              <div className="h-8 w-px bg-[#2A303C]"></div>
              <div>
                <div className="text-xs text-[#94A3B8] uppercase tracking-wider font-semibold">
                  Longest Record
                </div>
                <div className="text-2xl font-black text-[#F8F9FA] mt-0.5">
                  {result.streak.longestStreak} Days
                </div>
              </div>
            </div>
          )}

          <div className="text-xs text-[#94A3B8] flex items-center justify-center gap-1.5 pt-2">
            <Clock className="w-4 h-4 text-[#CADA03]" />
            <span>Attendance sessions automatically close after 3 hours.</span>
          </div>

          <div className="pt-2">
            <Link
              href="/home"
              className="w-full py-3 px-4 bg-[#CADA03] hover:bg-[#B8C702] text-[#0A0B0E] font-black rounded-xl flex items-center justify-center gap-2 transition text-sm uppercase"
            >
              <span>Back to Home</span>
            </Link>
          </div>
        </div>
      ) : (
        /* Action Console */
        <div className="bg-[#14171F] border border-[#2A303C] rounded-2xl p-6 sm:p-8 shadow-2xl text-center space-y-6">
          <div className="relative mx-auto w-44 h-44 rounded-3xl bg-[#0A0B0E] border-2 border-dashed border-[#CADA03]/50 flex flex-col items-center justify-center p-4">
            <QrCode className="w-20 h-20 text-[#CADA03]" />
            <div className="absolute inset-x-0 bottom-3 text-[10px] font-bold uppercase tracking-widest text-[#94A3B8]">
              Entrance Scanner
            </div>
          </div>

          <div>
            <h2 className="text-lg font-bold text-[#F8F9FA]">
              Entrance Station Check-In
            </h2>
            <p className="text-xs text-[#94A3B8] mt-1.5 max-w-xs mx-auto leading-relaxed">
              Permanent QR check-in records one visit per local calendar day in Asia/Kolkata.
            </p>
          </div>

          <button
            onClick={handleCheckIn}
            disabled={loading}
            className="w-full py-4 px-6 bg-[#CADA03] hover:bg-[#B8C702] active:scale-[0.98] text-[#0A0B0E] font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition text-sm shadow-[0_4px_20px_rgba(202,218,3,0.35)] disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-[#0A0B0E]" />
                <span>Recording Entrance...</span>
              </>
            ) : (
              <>
                <QrCode className="w-5 h-5 text-[#0A0B0E]" />
                <span>Check In Now</span>
              </>
            )}
          </button>

          <p className="text-[11px] text-[#94A3B8]/70">
            Sessions auto-close 3 hours after entrance. Duplicate scans on the same day do not disrupt active sessions or streaks.
          </p>
        </div>
      )}
    </div>
  );
}
