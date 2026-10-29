'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Flame, 
  QrCode, 
  CheckCircle2, 
  Calendar, 
  Clock, 
  Dumbbell, 
  AlertCircle, 
  ArrowRight,
  ShieldCheck,
  Megaphone,
  Activity,
  Users
} from 'lucide-react';
import clsx from 'clsx';

interface UserInfo {
  id: string;
  fullName: string;
  email: string;
  role: string;
}

interface MembershipInfo {
  planName: string;
  startDate: string;
  expiryDate: string;
  adminStatus: string;
  derivedStatus: string;
  allowed: boolean;
  daysRemaining?: number;
  reason?: string;
}

interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  lastAttendanceDate: string | null;
  displayStreak?: number;
  isStreakActive?: boolean;
  absentDaysElapsed?: number;
  isGraceDay?: boolean;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  isUrgent: boolean;
  publishedAt: string;
}

export default function MemberHomePage() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [membership, setMembership] = useState<MembershipInfo | null>(null);
  const [streak, setStreak] = useState<StreakInfo>({ currentStreak: 0, longestStreak: 0, lastAttendanceDate: null });
  const [checkedInToday, setCheckedInToday] = useState(false);
  const [liveOccupancy, setLiveOccupancy] = useState<number>(0);
  const [occupancyNotice, setOccupancyNotice] = useState<string>('Calm & Spaced • Great time to train');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [meRes, histRes, annRes] = await Promise.all([
          fetch('/api/auth/me'),
          fetch('/api/attendance/history'),
          fetch('/api/announcements'),
        ]);

        if (meRes.ok) {
          const meData = await meRes.json();
          setUser(meData.data.user);
          setMembership(meData.data.membership);
        }

        if (histRes.ok) {
          const histData = await histRes.json();
          setCheckedInToday(histData.data.checkedInToday);
          setStreak(histData.data.streak);
          if (typeof histData.data.liveOccupancy === 'number') {
            setLiveOccupancy(histData.data.liveOccupancy);
            if (histData.data.occupancyNotice) {
              setOccupancyNotice(histData.data.occupancyNotice);
            }
          }
        }

        if (annRes.ok) {
          const annData = await annRes.json();
          setAnnouncements(annData.data || []);
        }
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 bg-[#14171F] rounded-xl w-1/2"></div>
        <div className="h-44 bg-[#14171F] rounded-2xl"></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="h-28 bg-[#14171F] rounded-2xl"></div>
          <div className="h-28 bg-[#14171F] rounded-2xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Branded Athlete Hero Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#14171F] via-[#14171F] to-[#1D222E] border border-[#2A303C] p-4 sm:p-5 shadow-xl">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#CADA03] via-[#CADA03]/60 to-transparent" />
        <img
          src="/brand/boxinn-stacked-dark.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none select-none absolute -right-3 -bottom-3 h-28 w-auto opacity-[0.06] object-contain"
        />
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="hidden sm:flex items-center justify-center w-12 h-12 rounded-xl bg-[#0A0B0E] border border-[#CADA03]/30 p-1.5 shadow-inner shrink-0">
              <img
                src="/brand/bxn-badge.svg"
                alt="BOX INN"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#CADA03] mb-0.5">
                <span>BOX INN • Yelahanka</span>
                <span>•</span>
                <span className="text-[#94A3B8]">Rise Above The Average</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#F8F9FA]">
                Welcome back, {user?.fullName.split(' ')[0] || 'Athlete'}
              </h1>
            </div>
          </div>
          <div className="px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-[11px] font-bold text-emerald-400 flex items-center gap-1.5 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>ENROLLED</span>
          </div>
        </div>
      </div>

      {/* Live Gym Floor Occupancy Banner */}
      <div className="p-3.5 bg-[#14171F] border border-[#2A303C] hover:border-[#CADA03]/30 rounded-2xl flex items-center justify-between shadow-lg transition">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-[#1D222E] border border-[#CADA03]/30 text-[#CADA03]">
            <Activity className="w-4 h-4 text-[#CADA03]" />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#CADA03] animate-ping" />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#CADA03]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-[#F8F9FA]">
                Live Gym Floor: <span className="text-[#CADA03] font-mono">{liveOccupancy} {liveOccupancy === 1 ? 'Athlete' : 'Athletes'}</span> Active
              </span>
            </div>
            <p className="text-[11px] text-[#94A3B8] font-medium">
              {occupancyNotice}
            </p>
          </div>
        </div>
        <div className="text-right hidden sm:block">
          <span className="text-[10px] uppercase tracking-wider text-[#94A3B8] font-bold">Auto 3h window</span>
        </div>
      </div>

      {/* Urgent Announcements (if any) */}
      {announcements.filter((a) => a.isUrgent).map((a) => (
        <div
          key={a.id}
          className="p-3.5 bg-amber-950/40 border border-amber-500/40 rounded-2xl flex items-start gap-3 text-amber-200 text-xs shadow-lg"
        >
          <Megaphone className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-amber-300">{a.title}</div>
            <div className="mt-0.5 leading-relaxed text-amber-200/90">{a.content}</div>
          </div>
        </div>
      ))}

      {/* Check-In Card (Hero Action) */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#14171F] via-[#14171F] to-[#1D222E] border border-[#2A303C] rounded-2xl p-5 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-[#CADA03]">
              Entrance QR Check-In
            </span>
            <h2 className="text-lg font-black text-[#F8F9FA] mt-0.5">
              {checkedInToday ? 'Today’s Attendance Recorded' : 'Ready For Today’s Session?'}
            </h2>
            <p className="text-xs text-[#94A3B8] mt-1 max-w-sm leading-relaxed">
              {checkedInToday
                ? 'Your entrance check-in is logged. Sessions auto-close after 3 hours.'
                : 'Scan the entrance QR code on the gym floor or tap below to check in.'}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[#1D222E] border border-[#CADA03]/30 flex items-center justify-center text-[#CADA03]">
            {checkedInToday ? <CheckCircle2 className="w-6 h-6 text-emerald-400" /> : <QrCode className="w-6 h-6" />}
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-[#2A303C]/70 flex items-center justify-between">
          {checkedInToday ? (
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
              <span>Session Logged in Asia/Kolkata</span>
            </div>
          ) : (
            <Link
              href="/checkin"
              className="w-full sm:w-auto px-5 py-3 bg-[#CADA03] hover:bg-[#B8C702] text-[#0A0B0E] font-black rounded-xl flex items-center justify-center gap-2 transition text-xs shadow-[0_4px_16px_rgba(202,218,3,0.3)] active:scale-95 uppercase"
            >
              <span>Tap to Check In</span>
              <ArrowRight className="w-4 h-4 text-[#0A0B0E]" />
            </Link>
          )}

          <Link
            href="/attendance"
            className="text-xs font-bold text-[#94A3B8] hover:text-[#CADA03] flex items-center gap-1 transition"
          >
            <span>History</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Grid: Consistency Streak & Membership Status */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {/* Streak Counter Widget */}
        <div className="bg-[#14171F] border border-[#2A303C] rounded-2xl p-4 flex flex-col justify-between shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
              Daily Consistency Streak
            </span>
            <div className="p-1.5 rounded-lg bg-[#1D222E] text-[#CADA03]">
              <Flame className="w-4 h-4" />
            </div>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-[#F8F9FA]">
              {streak.displayStreak ?? streak.currentStreak}
            </span>
            <span className="text-xs font-black text-[#CADA03] uppercase tracking-wider">
              Days Active
            </span>
          </div>

          <div className="mt-3 pt-3 border-t border-[#2A303C] flex items-center justify-between text-[11px] text-[#94A3B8]">
            <span>Best: <strong className="text-[#F8F9FA]">{streak.longestStreak} days</strong></span>
            {streak.absentDaysElapsed && streak.absentDaysElapsed > 0 ? (
              <span className="text-amber-400 font-medium">
                Grace: {4 - streak.absentDaysElapsed}d left
              </span>
            ) : (
              <span className="text-emerald-400 font-medium">Streak on fire</span>
            )}
          </div>
        </div>

        {/* Membership Status Card */}
        <div className="bg-[#14171F] border border-[#2A303C] rounded-2xl p-4 flex flex-col justify-between shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
              Membership Status
            </span>
            <span
              className={clsx(
                'px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase',
                membership?.derivedStatus === 'ACTIVE'
                  ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-400'
                  : 'bg-red-950/60 border border-red-500/40 text-red-400'
              )}
            >
              {membership?.derivedStatus || 'INACTIVE'}
            </span>
          </div>

          <div>
            <div className="text-sm font-bold text-[#F8F9FA] truncate">
              {membership?.planName || 'General Training'}
            </div>
            <div className="text-xs text-[#94A3B8] mt-0.5">
              {membership?.daysRemaining !== undefined
                ? `${membership.daysRemaining} days remaining`
                : 'Check expiry date'}
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-[#2A303C] flex items-center justify-between text-[11px] text-[#94A3B8]">
            <span>Expiry Date</span>
            <span className="font-semibold text-[#F8F9FA] font-mono">
              {membership?.expiryDate || 'N/A'}
            </span>
          </div>
        </div>
      </div>

      {/* Gym Announcements Feed */}
      {announcements.length > 0 && (
        <div className="bg-[#14171F] border border-[#2A303C] rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#94A3B8] flex items-center gap-1.5">
              <Megaphone className="w-3.5 h-3.5 text-[#CADA03]" /> Gym Updates & Timings
            </h3>
          </div>
          <div className="space-y-3">
            {announcements.slice(0, 3).map((item) => (
              <div key={item.id} className="p-3 bg-[#1D222E]/80 rounded-xl border border-[#2A303C]">
                <div className="flex items-center justify-between text-xs font-bold text-[#F8F9FA]">
                  <span>{item.title}</span>
                  <span className="text-[10px] text-[#94A3B8] font-mono font-normal">
                    {new Date(item.publishedAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed">{item.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Navigation to Equipment Guides */}
      <div className="bg-[#14171F] border border-[#2A303C] rounded-2xl p-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1D222E] border border-[#2A303C] flex items-center justify-center text-[#CADA03]">
            <Dumbbell className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-[#F8F9FA]">Equipment & Exercise Guides</div>
            <div className="text-xs text-[#94A3B8]">Trainer-approved movement tutorials & form cues</div>
          </div>
        </div>
        <Link
          href="/machines"
          className="p-2.5 bg-[#1D222E] hover:bg-[#2A303C] text-[#CADA03] rounded-xl transition"
        >
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
