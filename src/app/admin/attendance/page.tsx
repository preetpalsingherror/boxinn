'use client';

import { useState, useEffect } from 'react';
import { 
  Calendar, 
  Search, 
  CheckCircle2, 
  Clock, 
  Edit3, 
  X, 
  Loader2, 
  AlertCircle,
  ShieldCheck,
  Flame,
  Download
} from 'lucide-react';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '../../../presentation/security/cookie-constants.ts';

interface AttendanceItem {
  id: string;
  gymDate: string;
  checkInTime: string;
  checkOutTime: string | null;
  source: string;
  isAutoClosed: boolean;
  user: {
    id: string;
    fullName: string;
    email: string;
  };
  corrections: Array<{
    id: string;
    originalGymDate: string;
    correctedGymDate: string;
    reason: string;
    createdAt: string;
    admin: { fullName: string };
  }>;
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
  return match ? decodeURIComponent(match[3]) : null;
}

export default function AdminAttendancePage() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [records, setRecords] = useState<AttendanceItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Correction Modal
  const [selectedRecord, setSelectedRecord] = useState<AttendanceItem | null>(null);
  const [correctedDate, setCorrectedDate] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadAttendance = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/attendance?date=${date}`);
      if (res.ok) {
        const data = await res.json();
        setRecords(data.data.records || []);
      }
    } catch (err) {
      console.error('Failed to load attendance:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAttendance();
  }, [date]);

  const handleExportCSV = () => {
    if (records.length === 0) return;
    const headers = ['Athlete Name', 'Email', 'Gym Date', 'Check-In Time (IST)', 'Check-Out Time (IST)', 'Source', 'Auto Closed'];
    const rows = records.map((r) => {
      const checkIn = new Date(r.checkInTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      const checkOut = r.checkOutTime ? new Date(r.checkOutTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'Still Active';
      return [
        `"${r.user.fullName.replace(/"/g, '""')}"`,
        `"${r.user.email.replace(/"/g, '""')}"`,
        `"${r.gymDate}"`,
        `"${checkIn}"`,
        `"${checkOut}"`,
        `"${r.source}"`,
        `"${r.isAutoClosed ? 'Yes' : 'No'}"`,
      ].join(',');
    });
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `boxinn-attendance-${date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCorrect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const csrfToken = getCookie(CSRF_COOKIE_NAME) || '';
      const res = await fetch('/api/admin/attendance/correct', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [CSRF_HEADER_NAME]: csrfToken,
        },
        body: JSON.stringify({
          userId: selectedRecord.user.id,
          originalGymDate: selectedRecord.gymDate,
          correctedGymDate: correctedDate,
          reason: correctionReason,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Correction failed.');
      }

      setSuccess('Attendance record corrected and streak recalculated.');
      setTimeout(() => {
        setSelectedRecord(null);
        setSuccess(null);
        loadAttendance();
      }, 1200);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Correction failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#F8F9FA]">
            Attendance Logs & Audit Trail
          </h1>
          <p className="text-xs text-[#94A3B8] mt-0.5">
            Physical entrance QR check-ins and server-enforced session closures in Asia/Kolkata.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            disabled={records.length === 0}
            className="px-3 py-1.5 bg-[#14171F] hover:bg-[#1D222E] text-xs font-bold text-[#F8F9FA] hover:text-[#CADA03] border border-[#2A303C] rounded-xl flex items-center gap-1.5 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5 text-[#CADA03]" />
            <span>Export CSV</span>
          </button>

          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-[#94A3B8]">Filter Date:</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="px-3 py-1.5 bg-[#14171F] border border-[#2A303C] rounded-xl text-xs text-[#F8F9FA] outline-none font-mono"
            />
          </div>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-[#14171F] border border-[#2A303C] rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 bg-[#0A0B0E] border-b border-[#2A303C] flex items-center justify-between text-xs">
          <span className="font-bold text-[#F8F9FA]">
            Check-Ins on {date} ({records.length} total)
          </span>
          <span className="text-[11px] text-[#94A3B8]">Auto-closes 3 hours post entrance</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#94A3B8]">
            <thead className="bg-[#14171F] text-[#94A3B8] uppercase text-[10px] tracking-wider border-b border-[#2A303C]">
              <tr>
                <th className="py-3 px-4">Athlete</th>
                <th className="py-3 px-4">Entrance Time</th>
                <th className="py-3 px-4">Check-Out / Closure</th>
                <th className="py-3 px-4">Source & Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2A303C]/70">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[#94A3B8]">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#CADA03]" />
                    <span>Loading attendance records...</span>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[#94A3B8]">
                    No check-ins recorded for date {date}.
                  </td>
                </tr>
              ) : (
                records.map((r) => {
                  const checkIn = new Date(r.checkInTime);
                  const checkOut = r.checkOutTime ? new Date(r.checkOutTime) : null;
                  const hasCorrections = r.corrections.length > 0;

                  return (
                    <tr key={r.id} className="hover:bg-[#1D222E]/50 transition">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-[#F8F9FA]">{r.user.fullName}</div>
                        <div className="text-[11px] text-[#94A3B8] font-mono">{r.user.email}</div>
                      </td>

                      <td className="py-3.5 px-4 font-mono">
                        {checkIn.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>

                      <td className="py-3.5 px-4 font-mono">
                        {checkOut ? (
                          checkOut.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })
                        ) : (
                          <span className="text-emerald-400 font-bold">In Gym</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-[#0A0B0E] border border-[#2A303C] text-[10px] font-bold text-[#94A3B8] uppercase">
                            {r.source.replace('_', ' ')}
                          </span>
                          {r.isAutoClosed && (
                            <span className="text-[10px] font-semibold text-amber-400">
                              Auto-closed
                            </span>
                          )}
                          {hasCorrections && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-950 text-blue-300 border border-blue-500/30">
                              Audited
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedRecord(r);
                            setCorrectedDate(r.gymDate);
                            setCorrectionReason('');
                            setError(null);
                            setSuccess(null);
                          }}
                          className="px-2.5 py-1.5 bg-[#1D222E] hover:bg-[#2A303C] text-[#CADA03] hover:text-white rounded-lg text-[11px] font-bold border border-[#2A303C] transition flex items-center gap-1 ml-auto"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Correct Date</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Attendance Correction Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#14171F] border border-[#2A303C] rounded-2xl p-6 shadow-2xl relative">
            <button
              onClick={() => setSelectedRecord(null)}
              className="absolute top-4 right-4 text-[#94A3B8] hover:text-[#F8F9FA]"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-bold text-[#F8F9FA] mb-1">
              Correct Attendance Record
            </h2>
            <p className="text-xs text-[#94A3B8] mb-4">
              Athlete: <strong className="text-[#F8F9FA]">{selectedRecord.user.fullName}</strong> ({selectedRecord.user.email})
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-950/40 border border-red-500/40 rounded-xl text-red-200 text-xs">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-4 p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-emerald-200 text-xs">
                {success}
              </div>
            )}

            <form onSubmit={handleCorrect} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                    Original Gym Date
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={selectedRecord.gymDate}
                    className="w-full px-3 py-2 bg-[#0A0B0E] border border-[#2A303C] rounded-xl text-xs text-[#94A3B8] font-mono outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                    Corrected Gym Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={correctedDate}
                    onChange={(e) => setCorrectedDate(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0A0B0E] border border-[#2A303C] focus:border-[#CADA03] rounded-xl text-xs text-[#F8F9FA] outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                  Mandatory Audit Reason *
                </label>
                <textarea
                  required
                  rows={2}
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  placeholder="e.g. Athlete scanned past midnight for previous evening's training session."
                  className="w-full px-3 py-2 bg-[#0A0B0E] border border-[#2A303C] focus:border-[#CADA03] rounded-xl text-xs text-[#F8F9FA] outline-none"
                />
              </div>

              <div className="p-3 bg-[#1D222E] rounded-xl border border-[#2A303C] text-[11px] text-[#94A3B8] flex items-center gap-2">
                <Flame className="w-4 h-4 text-[#CADA03] shrink-0" />
                <span>Submitting will atomically update the record, log the audit entry, and recalculate the member&apos;s full consistency streak ledger.</span>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedRecord(null)}
                  className="px-4 py-2 bg-[#1D222E] hover:bg-[#2A303C] text-xs font-bold text-[#F8F9FA] rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !correctionReason}
                  className="px-4 py-2 bg-[#CADA03] hover:bg-[#B8C702] text-xs font-black text-[#0A0B0E] rounded-xl flex items-center gap-1.5 disabled:opacity-50 uppercase"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save & Recalculate Streak</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
