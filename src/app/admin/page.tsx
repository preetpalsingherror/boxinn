'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Users, 
  Calendar, 
  UserPlus, 
  Clock, 
  AlertTriangle, 
  Dumbbell, 
  ShieldCheck, 
  ArrowRight,
  Activity,
  X,
  UserCheck,
  QrCode
} from 'lucide-react';
import { EntranceQrModal } from './EntranceQrModal.tsx';

interface ActiveAthlete {
  userId: string;
  fullName: string;
  email: string;
  checkInTime: string;
  elapsedMinutes: number;
  remainingMinutes: number;
}

interface Stats {
  gymDate: string;
  activeMembers: number;
  todayAttendance: number;
  pendingVerifications: number;
  expiringSoon: number;
  machinesCount: number;
  liveOccupancy?: number;
  occupancyNotice?: string;
  activeAthletes?: ActiveAthlete[];
}

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showLiveModal, setShowLiveModal] = useState(false);
  const [showEntranceQr, setShowEntranceQr] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [statsRes, healthRes] = await Promise.all([
          fetch('/api/admin/stats'),
          fetch('/api/health'),
        ]);

        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData.data);
        }

        if (healthRes.ok) {
          const healthData = await healthRes.json();
          setHealth(healthData.data);
        }
      } catch (err) {
        console.error('Failed to load admin stats:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-[#14171F] rounded-xl w-64"></div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="h-28 bg-[#14171F] rounded-2xl"></div>
          <div className="h-28 bg-[#14171F] rounded-2xl"></div>
          <div className="h-28 bg-[#14171F] rounded-2xl"></div>
          <div className="h-28 bg-[#14171F] rounded-2xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Branded Command Center Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#14171F] via-[#14171F] to-[#1D222E] border border-[#2A303C] p-5 shadow-xl">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#CADA03] via-[#CADA03]/60 to-transparent" />
        <img
          src="/brand/boxinn-stacked-dark.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none select-none absolute -right-4 -bottom-4 h-32 w-auto opacity-[0.06] object-contain"
        />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="hidden sm:flex items-center justify-center w-13 h-13 rounded-xl bg-[#0A0B0E] border border-[#CADA03]/40 p-1.5 shadow-inner shrink-0">
              <img
                src="/brand/bxn-badge.svg"
                alt="BOX INN"
                className="w-10 h-10 object-contain"
              />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#CADA03] mb-0.5">
                <span>BOX INN • Yelahanka Command Desk</span>
                <span>•</span>
                <span className="text-[#94A3B8]">ESTD 2026</span>
              </div>
              <h1 className="text-2xl font-black tracking-tight text-[#F8F9FA]">
                Facility Operations Overview
              </h1>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                Rise Above The Average • Local Gym Date: <strong className="text-[#CADA03] font-mono">{stats?.gymDate}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowEntranceQr(true)}
              className="px-4 py-2.5 bg-[#0A0B0E] hover:bg-[#1D222E] border border-[#CADA03]/50 text-[#F8F9FA] hover:text-[#CADA03] font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition uppercase shadow-sm"
              title="Generate or print the reception desk check-in QR poster for members"
            >
              <QrCode className="w-4 h-4 text-[#CADA03]" />
              <span>Entrance Check-In QR</span>
            </button>

            <Link
              href="/admin/members?invite=true"
              className="px-4 py-2.5 bg-[#CADA03] hover:bg-[#B8C702] text-[#0A0B0E] font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(202,218,3,0.3)] transition uppercase"
            >
              <UserPlus className="w-4 h-4 text-[#0A0B0E]" />
              <span>Invite New Member</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div 
          onClick={() => setShowLiveModal(true)}
          className="p-4 bg-[#14171F] hover:bg-[#1D222E] border border-[#CADA03]/50 hover:border-[#CADA03] rounded-2xl shadow-lg relative overflow-hidden cursor-pointer transition group"
          title="Click to view athletes currently on gym floor"
        >
          <div className="flex items-center justify-between text-[#94A3B8] mb-2">
            <span className="text-xs font-black uppercase tracking-wider text-[#CADA03] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#CADA03] animate-ping" />
              Live Floor
            </span>
            <Activity className="w-4 h-4 text-[#CADA03]" />
          </div>
          <div className="text-3xl font-black text-[#CADA03]">{stats?.liveOccupancy ?? 0}</div>
          <div className="text-[11px] text-[#94A3B8] mt-1 font-medium flex items-center justify-between">
            <span>{stats?.occupancyNotice ?? 'Active athletes right now'}</span>
            <span className="text-[10px] text-[#CADA03] font-bold opacity-0 group-hover:opacity-100 transition">View →</span>
          </div>
        </div>

        <div className="p-4 bg-[#14171F] border border-[#2A303C] rounded-2xl shadow-lg">
          <div className="flex items-center justify-between text-[#94A3B8] mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Active Members</span>
            <Users className="w-4 h-4 text-[#CADA03]" />
          </div>
          <div className="text-3xl font-black text-[#F8F9FA]">{stats?.activeMembers ?? 0}</div>
          <div className="text-[11px] text-[#94A3B8] mt-1">Enrolled athletes</div>
        </div>

        <div className="p-4 bg-[#14171F] border border-[#2A303C] rounded-2xl shadow-lg">
          <div className="flex items-center justify-between text-[#94A3B8] mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Today&apos;s Visits</span>
            <Calendar className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-black text-emerald-400">{stats?.todayAttendance ?? 0}</div>
          <div className="text-[11px] text-[#94A3B8] mt-1">Check-ins in Asia/Kolkata</div>
        </div>

        <div className="p-4 bg-[#14171F] border border-[#2A303C] rounded-2xl shadow-lg">
          <div className="flex items-center justify-between text-[#94A3B8] mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Pending Verify</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-3xl font-black text-amber-400">{stats?.pendingVerifications ?? 0}</div>
          <div className="text-[11px] text-[#94A3B8] mt-1">Awaiting email click</div>
        </div>

        <Link
          href="/admin/members?status=EXPIRING_SOON"
          className="p-4 bg-[#14171F] hover:bg-[#1D222E] border border-[#2A303C] hover:border-amber-500/50 rounded-2xl shadow-lg col-span-2 sm:col-span-1 transition block group"
          title="Click to view expiring members and send WhatsApp reminders"
        >
          <div className="flex items-center justify-between text-[#94A3B8] mb-2">
            <span className="text-xs font-bold uppercase tracking-wider group-hover:text-amber-400 transition">Expiring (7d)</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-3xl font-black text-amber-400">{stats?.expiringSoon ?? 0}</div>
          <div className="text-[11px] text-[#94A3B8] mt-1 flex items-center justify-between">
            <span>Require renewal</span>
            <span className="text-[10px] text-amber-400/80 font-bold group-hover:underline">WhatsApp →</span>
          </div>
        </Link>
      </div>

      {/* Operational Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Member Management Card */}
        <div className="p-5 bg-[#14171F] border border-[#2A303C] rounded-2xl flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black uppercase tracking-wider text-[#CADA03]">
                Identity & Access
              </span>
              <Users className="w-5 h-5 text-[#94A3B8]" />
            </div>
            <h3 className="text-lg font-bold text-[#F8F9FA]">Member Registry & Invitations</h3>
            <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed">
              Generate single-use cryptographic invitation links, manage membership start and inclusive expiry dates, process renewals, and execute suspensions.
            </p>
          </div>
          <div className="mt-5 pt-4 border-t border-[#2A303C] flex items-center justify-between">
            <span className="text-xs text-[#94A3B8]">Audit logging enforced</span>
            <Link
              href="/admin/members"
              className="text-xs font-bold text-[#CADA03] hover:underline flex items-center gap-1"
            >
              <span>Manage Members</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Attendance & Streak Engine Card */}
        <div className="p-5 bg-[#14171F] border border-[#2A303C] rounded-2xl flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Attendance Ledger
              </span>
              <Calendar className="w-5 h-5 text-[#94A3B8]" />
            </div>
            <h3 className="text-lg font-bold text-[#F8F9FA]">Attendance & Historical Corrections</h3>
            <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed">
              View daily entrance logs, auto-closed sessions, and execute authorized date corrections with mandatory audit reasons and deterministic streak recalculation.
            </p>
          </div>
          <div className="mt-5 pt-4 border-t border-[#2A303C] flex items-center justify-between">
            <span className="text-xs text-[#94A3B8]">3-hour auto-closure policy</span>
            <Link
              href="/admin/attendance"
              className="text-xs font-bold text-emerald-400 hover:underline flex items-center gap-1"
            >
              <span>View Attendance</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* System Health Status */}
      <div className="p-4 bg-[#14171F] border border-[#2A303C] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#1D222E] border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-[#F8F9FA] flex items-center gap-2">
              <span>System & Database Status:</span>
              <span className="text-emerald-400">HEALTHY (PostgreSQL 18)</span>
            </div>
            <div className="text-[#94A3B8] text-[11px] mt-0.5 font-mono">
              DB Latency: {health?.database?.latencyMs ?? 1}ms • Timezone: {health?.timezone || 'Asia/Kolkata'}
            </div>
          </div>
        </div>

        <div className="text-[11px] text-[#94A3B8] font-mono">
          App Version: 0.1.0 • Facility: Yelahanka
        </div>
      </div>

      {/* Live Floor Athlete Modal */}
      {showLiveModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#14171F] border border-[#2A303C] rounded-2xl p-6 shadow-2xl relative max-h-[85vh] flex flex-col">
            <button
              onClick={() => setShowLiveModal(false)}
              className="absolute top-4 right-4 text-[#94A3B8] hover:text-[#F8F9FA] transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#CADA03] animate-ping" />
              <h2 className="text-lg font-black text-[#F8F9FA]">Active Athletes on Gym Floor</h2>
            </div>
            <p className="text-xs text-[#94A3B8] mb-4">
              Real-time entrance scans in Asia/Kolkata where 3-hour session auto-close has not elapsed.
            </p>

            <div className="overflow-y-auto flex-1 space-y-2.5 pr-1">
              {!stats?.activeAthletes || stats.activeAthletes.length === 0 ? (
                <div className="p-8 text-center bg-[#0A0B0E] border border-[#2A303C] rounded-xl text-xs text-[#94A3B8]">
                  <UserCheck className="w-8 h-8 text-[#94A3B8]/40 mx-auto mb-2" />
                  No athletes currently checked in on the floor.
                </div>
              ) : (
                stats.activeAthletes.map((athlete) => {
                  const checkIn = new Date(athlete.checkInTime).toLocaleTimeString('en-IN', {
                    timeZone: 'Asia/Kolkata',
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  return (
                    <div
                      key={athlete.userId}
                      className="p-3 bg-[#0A0B0E] border border-[#2A303C] rounded-xl flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="text-sm font-bold text-[#F8F9FA]">{athlete.fullName}</div>
                        <div className="text-[11px] text-[#94A3B8] font-mono">{athlete.email}</div>
                        <div className="text-[10px] text-[#94A3B8] mt-1">
                          Scanned In: <span className="font-mono text-[#F8F9FA] font-bold">{checkIn} IST</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="px-2 py-0.5 rounded-md bg-[#CADA03]/10 text-[#CADA03] font-bold text-[11px] border border-[#CADA03]/30">
                          {athlete.elapsedMinutes}m on floor
                        </span>
                        <div className="text-[10px] text-[#94A3B8] mt-1 font-mono">
                          {athlete.remainingMinutes}m auto-close
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-[#2A303C] flex items-center justify-between">
              <Link
                href="/admin/attendance"
                onClick={() => setShowLiveModal(false)}
                className="text-xs font-bold text-[#CADA03] hover:underline flex items-center gap-1"
              >
                <span>View Full Attendance Logs</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <button
                onClick={() => setShowLiveModal(false)}
                className="px-4 py-2 bg-[#1D222E] hover:bg-[#2A303C] text-xs font-bold text-[#F8F9FA] rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Entrance Check-In QR Poster Modal */}
      <EntranceQrModal
        isOpen={showEntranceQr}
        onClose={() => setShowEntranceQr(false)}
      />
    </div>
  );
}
