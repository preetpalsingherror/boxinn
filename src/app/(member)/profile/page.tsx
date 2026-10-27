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
  Loader2 
} from 'lucide-react';
import clsx from 'clsx';

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
          <div className="w-12 h-12 rounded-2xl bg-[#1D222E] border border-[#FF5500]/40 flex items-center justify-center text-[#FF5500] font-black text-lg">
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
              <ShieldCheck className="w-3.5 h-3.5 text-[#FF5500]" /> Role
            </span>
            <span className="font-semibold text-[#F8F9FA]">{user?.role}</span>
          </div>

          <div className="flex items-center justify-between text-[#94A3B8]">
            <span className="flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-[#FF5500]" /> Email Status
            </span>
            <span className="font-semibold text-emerald-400">Verified</span>
          </div>
        </div>
      </div>

      {/* Membership Details Card */}
      <div className="bg-[#14171F] border border-[#2A303C] rounded-2xl p-5 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[#94A3B8] flex items-center gap-1.5">
            <CreditCard className="w-4 h-4 text-[#FF5500]" /> Membership Enrollment
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
              <span className="font-bold text-[#FF5500]">{membership.daysRemaining} days</span>
            </div>
          )}
        </div>

        <p className="text-[11px] text-[#94A3B8] leading-relaxed">
          Memberships are valid through 23:59:59 on the recorded expiry date in Asia/Kolkata. For plan renewals or extensions, speak with front desk staff.
        </p>
      </div>

      {/* Security Actions */}
      <div className="bg-[#14171F] border border-[#2A303C] rounded-2xl p-4 shadow-xl space-y-2">
        <Link
          href="/forgot-password"
          className="w-full py-3 px-3.5 bg-[#1D222E] hover:bg-[#2A303C] text-xs font-semibold text-[#F8F9FA] rounded-xl flex items-center justify-between transition"
        >
          <span className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-[#FF5500]" /> Change Password
          </span>
          <span className="text-[#94A3B8]">→</span>
        </Link>

        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full py-3 px-3.5 bg-red-950/30 hover:bg-red-950/50 border border-red-500/30 text-xs font-bold text-red-300 rounded-xl flex items-center justify-center gap-2 transition disabled:opacity-50"
        >
          {loggingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
          <span>Sign Out of All Devices</span>
        </button>
      </div>
    </div>
  );
}
