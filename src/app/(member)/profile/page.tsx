'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  User, 
  Mail, 
  Phone, 
  ShieldCheck, 
  CreditCard, 
  Calendar, 
  LogOut, 
  KeyRound, 
  Loader2,
  X,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import clsx from 'clsx';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '../../../presentation/security/cookie-constants.ts';

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
  return match ? decodeURIComponent(match[3]) : null;
}

interface ProfileData {
  user: {
    id: string;
    email: string;
    fullName: string;
    phone?: string | null;
    role: string;
    status: string;
  };
  membership: {
    planName: string;
    startDate: string;
    expiryDate: string;
    adminStatus: string;
    derivedStatus: string;
    daysRemaining?: number;
    reason?: string;
  } | null;
  streak: {
    currentStreak: number;
    longestStreak: number;
    lastAttendanceDate: string | null;
  };
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  // Change Password Modal
  const [showPwModal, setShowPwModal] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwSubmitting, setPwSubmitting] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(null);

    if (newPw.length < 8) {
      setPwError('New password must be at least 8 characters long.');
      return;
    }
    if (newPw !== confirmPw) {
      setPwError('New passwords do not match.');
      return;
    }

    setPwSubmitting(true);
    try {
      const csrfToken = getCookie(CSRF_COOKIE_NAME) || '';
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [CSRF_HEADER_NAME]: csrfToken,
        },
        body: JSON.stringify({
          currentPassword: currentPw,
          newPassword: newPw,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update password.');
      }

      setPwSuccess('Password updated successfully!');
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      setTimeout(() => {
        setShowPwModal(false);
        setPwSuccess(null);
      }, 1500);
    } catch (err: unknown) {
      setPwError(err instanceof Error ? err.message : 'Error updating password.');
    } finally {
      setPwSubmitting(false);
    }
  };

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          setProfile(data.data);
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch {
      router.push('/login');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse max-w-md mx-auto">
        <div className="h-32 bg-[#14171F] rounded-2xl"></div>
        <div className="h-44 bg-[#14171F] rounded-2xl"></div>
      </div>
    );
  }

  const { user, membership } = profile || { user: null, membership: null };

  return (
    <div className="space-y-5 max-w-md mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-black tracking-wider uppercase text-[#F8F9FA]">
          Athlete Profile
        </h1>
        <p className="text-xs text-[#94A3B8] mt-0.5">
          Member credentials and enrollment details.
        </p>
      </div>

      {/* Account Info Card */}
      <div className="bg-[#14171F] border border-[#2A303C] rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#1D222E] border border-[#CADA03]/40 flex items-center justify-center text-[#CADA03] font-black text-lg">
            {user?.fullName.charAt(0) || 'A'}
          </div>
          <div>
            <h2 className="text-base font-bold text-[#F8F9FA]">
              {user?.fullName || 'Athlete'}
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-[#94A3B8] font-mono">{user?.email}</span>
              <span className="px-2 py-0.2 rounded bg-emerald-950/60 border border-emerald-500/40 text-[9px] font-bold text-emerald-400 uppercase">
                {user?.status}
              </span>
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-[#2A303C] space-y-2 text-xs">
          <div className="flex items-center justify-between text-[#94A3B8]">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#CADA03]" /> Role
            </span>
            <span className="font-semibold text-[#F8F9FA]">{user?.role}</span>
          </div>

          <div className="flex items-center justify-between text-[#94A3B8]">
            <span className="flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-[#CADA03]" /> Email Status
            </span>
            <span className="font-semibold text-emerald-400">Verified</span>
          </div>
        </div>
      </div>

      {/* Membership Details Card */}
      <div className="bg-[#14171F] border border-[#2A303C] rounded-2xl p-5 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[#94A3B8] flex items-center gap-1.5">
            <CreditCard className="w-4 h-4 text-[#CADA03]" /> Membership Enrollment
          </span>
          <span
            className={clsx(
              'px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider',
              membership?.derivedStatus === 'ACTIVE'
                ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-400'
                : 'bg-red-950/60 border border-red-500/40 text-red-400'
            )}
          >
            {membership?.derivedStatus || 'INACTIVE'}
          </span>
        </div>

        <div className="p-3.5 bg-[#0A0B0E] border border-[#2A303C] rounded-xl space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[#94A3B8]">Plan Name</span>
            <span className="font-bold text-[#F8F9FA]">{membership?.planName || 'General Training'}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[#94A3B8]">Start Date</span>
            <span className="font-mono text-[#F8F9FA]">{membership?.startDate || 'N/A'}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[#94A3B8]">Expiry Date (Inclusive)</span>
            <span className="font-mono text-[#F8F9FA]">{membership?.expiryDate || 'N/A'}</span>
          </div>

          {membership?.daysRemaining !== undefined && (
            <div className="flex items-center justify-between pt-1 border-t border-[#2A303C]/50">
              <span className="text-[#94A3B8]">Days Remaining</span>
              <span className="font-bold text-[#CADA03]">{membership.daysRemaining} days</span>
            </div>
          )}
        </div>

        <p className="text-[11px] text-[#94A3B8] leading-relaxed">
          Memberships are valid through 23:59:59 on the recorded expiry date in Asia/Kolkata. For plan renewals or extensions, speak with front desk staff.
        </p>
      </div>

      {/* Security Actions */}
      <div className="bg-[#14171F] border border-[#2A303C] rounded-2xl p-4 shadow-xl space-y-2">
        <button
          type="button"
          onClick={() => {
            setShowPwModal(true);
            setPwError(null);
            setPwSuccess(null);
          }}
          className="w-full py-3 px-3.5 bg-[#1D222E] hover:bg-[#2A303C] text-xs font-semibold text-[#F8F9FA] rounded-xl flex items-center justify-between transition"
        >
          <span className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-[#CADA03]" /> Update Password
          </span>
          <span className="text-[#CADA03]">→</span>
        </button>

        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full py-3 px-3.5 bg-red-950/30 hover:bg-red-950/50 border border-red-500/30 text-xs font-bold text-red-300 rounded-xl flex items-center justify-center gap-2 transition disabled:opacity-50"
        >
          {loggingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
          <span>Sign Out of All Devices</span>
        </button>
      </div>

      {/* In-Place Change Password Modal */}
      {showPwModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#14171F] border border-[#2A303C] rounded-2xl p-6 shadow-2xl relative">
            <button
              onClick={() => setShowPwModal(false)}
              className="absolute top-4 right-4 text-[#94A3B8] hover:text-[#F8F9FA]"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#1D222E] border border-[#CADA03]/30 flex items-center justify-center text-[#CADA03]">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#F8F9FA]">Update Password</h2>
                <p className="text-xs text-[#94A3B8]">Set a new account password</p>
              </div>
            </div>

            {pwError && (
              <div className="mb-4 p-3 bg-red-950/40 border border-red-500/40 rounded-xl text-red-200 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{pwError}</span>
              </div>
            )}

            {pwSuccess && (
              <div className="mb-4 p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-emerald-200 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{pwSuccess}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  required
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0A0B0E] border border-[#2A303C] focus:border-[#CADA03] rounded-xl text-xs text-[#F8F9FA] outline-none"
                  placeholder="••••••••••••"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                  New Password (min 8 chars)
                </label>
                <input
                  type="password"
                  required
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0A0B0E] border border-[#2A303C] focus:border-[#CADA03] rounded-xl text-xs text-[#F8F9FA] outline-none"
                  placeholder="••••••••••••"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0A0B0E] border border-[#2A303C] focus:border-[#CADA03] rounded-xl text-xs text-[#F8F9FA] outline-none"
                  placeholder="••••••••••••"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPwModal(false)}
                  className="px-4 py-2 bg-[#1D222E] hover:bg-[#2A303C] text-xs font-bold text-[#F8F9FA] rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pwSubmitting}
                  className="px-4 py-2 bg-[#CADA03] hover:bg-[#B8C702] text-xs font-black text-[#0A0B0E] rounded-xl flex items-center gap-1.5 transition disabled:opacity-50 uppercase"
                >
                  {pwSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0A0B0E]" />}
                  <span>Save Password</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
