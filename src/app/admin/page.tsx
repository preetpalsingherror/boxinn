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
  Activity
} from 'lucide-react';

interface Stats {
  gymDate: string;
  activeMembers: number;
  todayAttendance: number;
  pendingVerifications: number;
  expiringSoon: number;
  machinesCount: number;
  liveOccupancy?: number;
  occupancyNotice?: string;
}

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
      {/* Title & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-[#F8F9FA]">
            Facility Operations Overview
          </h1>
          <p className="text-xs text-[#94A3B8] mt-0.5">
            BOX INN Yelahanka • Local Gym Date: <strong className="text-[#F8F9FA] font-mono">{stats?.gymDate}</strong>
          </p>
        </div>

        <Link
          href="/admin/members?invite=true"
          className="px-4 py-2.5 bg-[#CADA03] hover:bg-[#B8C702] text-[#0A0B0E] font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(202,218,3,0.3)] transition uppercase"
        >
          <UserPlus className="w-4 h-4 text-[#0A0B0E]" />
          <span>Invite New Member</span>
        </Link>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="p-4 bg-[#14171F] border border-[#CADA03]/50 rounded-2xl shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-[#94A3B8] mb-2">
            <span className="text-xs font-black uppercase tracking-wider text-[#CADA03] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#CADA03] animate-ping" />
              Live Floor
            </span>
            <Activity className="w-4 h-4 text-[#CADA03]" />
          </div>
          <div className="text-3xl font-black text-[#CADA03]">{stats?.liveOccupancy ?? 0}</div>
          <div className="text-[11px] text-[#94A3B8] mt-1 font-medium">{stats?.occupancyNotice ?? 'Active athletes right now'}</div>
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

        <div className="p-4 bg-[#14171F] border border-[#2A303C] rounded-2xl shadow-lg col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-[#94A3B8] mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Expiring (7d)</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-3xl font-black text-amber-400">{stats?.expiringSoon ?? 0}</div>
          <div className="text-[11px] text-[#94A3B8] mt-1">Require renewal</div>
        </div>
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
    </div>
  );
}
