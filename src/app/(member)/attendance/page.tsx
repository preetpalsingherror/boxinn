'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Calendar, Flame, Clock, CheckCircle2, ArrowLeft, Trophy } from 'lucide-react';
import clsx from 'clsx';

interface AttendanceRecord {
  id: string;
  gymDate: string;
  checkInTime: string;
  checkOutTime: string | null;
  source: string;
  isAutoClosed: boolean;
}

export default function AttendanceHistoryPage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [totalVisits, setTotalVisits] = useState(0);
  const [streak, setStreak] = useState({ currentStreak: 0, longestStreak: 0, displayStreak: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHistory() {
      try {
        const res = await fetch('/api/attendance/history');
        if (res.ok) {
          const data = await res.json();
          setRecords(data.data.records || []);
          setTotalVisits(data.data.totalVisits || 0);
          setStreak(data.data.streak || { currentStreak: 0, longestStreak: 0, displayStreak: 0 });
        }
      } catch (err) {
        console.error('Failed to fetch attendance history:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchHistory();
  }, []);

  const activityDays = useMemo(() => {
    const days = [];
    const attendedSet = new Set(records.map((r) => r.gymDate));
    const now = new Date();
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);

    for (let i = 27; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
      const dayNum = parseInt(dateStr.split('-')[2], 10);
      const isAttended = attendedSet.has(dateStr);
      const isToday = dateStr === todayStr;
      days.push({ dateStr, dayNum, isAttended, isToday });
    }
    return days;
  }, [records]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/home"
          className="p-2 -ml-2 text-[#94A3B8] hover:text-[#F8F9FA] rounded-lg transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-lg font-black tracking-wider uppercase text-[#F8F9FA]">
          Attendance Ledger
        </h1>
        <div className="w-9"></div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
        <div className="p-3 bg-[#14171F] border border-[#2A303C] rounded-2xl">
          <div className="text-[10px] font-bold text-[#94A3B8] uppercase">Total Visits</div>
          <div className="text-xl sm:text-2xl font-black text-[#F8F9FA] mt-1">{totalVisits}</div>
        </div>
        <div className="p-3 bg-[#14171F] border border-[#2A303C] rounded-2xl">
          <div className="text-[10px] font-bold text-[#CADA03] uppercase">Active Streak</div>
          <div className="text-xl sm:text-2xl font-black text-[#CADA03] mt-1 flex items-center justify-center gap-1">
            <Flame className="w-4 h-4 text-[#CADA03]" />
            <span>{streak.displayStreak ?? streak.currentStreak}d</span>
          </div>
        </div>
        <div className="p-3 bg-[#14171F] border border-[#2A303C] rounded-2xl">
          <div className="text-[10px] font-bold text-[#94A3B8] uppercase">Best Record</div>
          <div className="text-xl sm:text-2xl font-black text-[#F8F9FA] mt-1 flex items-center justify-center gap-1">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span>{streak.longestStreak}d</span>
          </div>
        </div>
      </div>

      {/* 28-Day Consistency Strip */}
      <div className="bg-[#14171F] border border-[#2A303C] rounded-2xl p-4 sm:p-5 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#94A3B8] flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-[#CADA03]" />
            <span>28-Day Training Heatstrip</span>
          </h2>
          <div className="flex items-center gap-3 text-[10px] text-[#94A3B8]">
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-[#CADA03]" />
              <span>Trained</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-[#1D222E] border border-[#2A303C]" />
              <span>Rest</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-7 sm:grid-cols-14 gap-1.5 pt-1">
          {activityDays.map((d) => (
            <div
              key={d.dateStr}
              title={`${d.dateStr}: ${d.isAttended ? 'Trained' : 'Rest'}`}
              className={clsx(
                'aspect-square rounded-lg flex flex-col items-center justify-center text-[10px] font-mono transition',
                d.isAttended
                  ? 'bg-[#CADA03] text-[#0A0B0E] font-black shadow-[0_0_8px_rgba(202,218,3,0.35)]'
                  : d.isToday
                  ? 'bg-[#1D222E] text-[#F8F9FA] border border-[#CADA03]/50'
                  : 'bg-[#14171F] text-[#94A3B8]/60 border border-[#2A303C]'
              )}
            >
              <span>{d.dayNum}</span>
            </div>
          ))}
        </div>
      </div>

      {/* History List */}
      <div className="bg-[#14171F] border border-[#2A303C] rounded-2xl p-4 sm:p-5 shadow-xl">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#94A3B8] mb-4 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#CADA03]" />
          <span>Gym-Local Calendar Days (Asia/Kolkata)</span>
        </h2>

        {loading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-14 bg-[#1D222E] rounded-xl"></div>
            <div className="h-14 bg-[#1D222E] rounded-xl"></div>
            <div className="h-14 bg-[#1D222E] rounded-xl"></div>
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-12 text-[#94A3B8] space-y-2">
            <Calendar className="w-10 h-10 mx-auto text-[#2A303C]" />
            <p className="text-sm font-semibold text-[#F8F9FA]">No attendance records logged yet.</p>
            <p className="text-xs">Your check-ins will appear here with local timestamps and session duration.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {records.map((r) => {
              const checkIn = new Date(r.checkInTime);
              const checkOut = r.checkOutTime ? new Date(r.checkOutTime) : null;

              return (
                <div
                  key={r.id}
                  className="p-3.5 bg-[#1D222E]/80 border border-[#2A303C] rounded-xl flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#0A0B0E] border border-[#2A303C] flex items-center justify-center text-emerald-400">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-[#F8F9FA] font-mono">
                        {r.gymDate}
                      </div>
                      <div className="text-[11px] text-[#94A3B8] flex items-center gap-2 mt-0.5">
                        <Clock className="w-3 h-3 text-[#CADA03]" />
                        <span>
                          {checkIn.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}
                          {checkOut ? ` – ${checkOut.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}` : ' (In session)'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-[#0A0B0E] text-[#94A3B8] border border-[#2A303C]">
                      {r.isAutoClosed ? 'Auto-closed (3h)' : r.checkOutTime ? 'Completed' : 'Active'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
