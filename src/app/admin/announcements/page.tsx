'use client';

import { useState, useEffect } from 'react';
import { 
  Megaphone, 
  Plus, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  ShieldCheck 
} from 'lucide-react';
import clsx from 'clsx';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '../../../presentation/security/cookie-constants.ts';

interface AnnouncementItem {
  id: string;
  title: string;
  content: string;
  isUrgent: boolean;
  publishedAt: string;
  createdBy: {
    fullName: string;
    role: string;
  };
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
  return match ? decodeURIComponent(match[3]) : null;
}

export default function AdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const loadAnnouncements = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/announcements');
      if (res.ok) {
        const data = await res.json();
        setAnnouncements(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load announcements:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const csrfToken = getCookie(CSRF_COOKIE_NAME) || '';
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [CSRF_HEADER_NAME]: csrfToken,
        },
        body: JSON.stringify({
          title,
          content,
          isUrgent,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to publish announcement.');
      }

      setSuccess(true);
      setTitle('');
      setContent('');
      setIsUrgent(false);
      loadAnnouncements();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error publishing announcement.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#F8F9FA]">
          Facility Announcements & Notice Board
        </h1>
        <p className="text-xs text-[#94A3B8] mt-0.5">
          Broadcast gym timings, workshop schedules, and operational alerts to enrolled members.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Creator Form */}
        <div className="lg:col-span-1 bg-[#14171F] border border-[#2A303C] rounded-2xl p-5 shadow-xl h-fit">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#F8F9FA] mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4 text-[#FF5500]" />
            <span>Publish New Notice</span>
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-red-950/40 border border-red-500/40 rounded-xl text-red-200 text-xs">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-emerald-200 text-xs flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Announcement published to member dashboard!</span>
            </div>
          )}

          <form onSubmit={handlePublish} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                Notice Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. HYROX Simulation Workshop This Saturday"
                className="w-full px-3 py-2 bg-[#0A0B0E] border border-[#2A303C] focus:border-[#FF5500] rounded-xl text-xs text-[#F8F9FA] outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                Content Details *
              </label>
              <textarea
                required
                rows={4}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Session details, timing in Asia/Kolkata, registration requirements..."
                className="w-full px-3 py-2 bg-[#0A0B0E] border border-[#2A303C] focus:border-[#FF5500] rounded-xl text-xs text-[#F8F9FA] outline-none"
              />
            </div>

            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-[#0A0B0E] border border-[#2A303C] cursor-pointer">
              <input
                type="checkbox"
                checked={isUrgent}
                onChange={(e) => setIsUrgent(e.target.checked)}
                className="rounded accent-[#FF5500] w-4 h-4 cursor-pointer"
              />
              <span className="text-xs font-semibold text-[#F8F9FA]">
                Flag as Urgent Alert (Pins to top of Member Home)
              </span>
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 bg-[#FF5500] hover:bg-[#E04B00] text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow-[0_4px_16px_rgba(255,85,0,0.3)] disabled:opacity-50"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Broadcast Announcement</span>
            </button>
          </form>
        </div>

        {/* Existing Announcements Feed */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#94A3B8] mb-2 flex items-center gap-1.5">
            <Megaphone className="w-4 h-4 text-[#FF5500]" />
            <span>Active Announcements Feed ({announcements.length})</span>
          </h2>

          {loading ? (
            <div className="py-12 text-center text-[#94A3B8]">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#FF5500]" />
              <span>Loading notices...</span>
            </div>
          ) : announcements.length === 0 ? (
            <div className="p-8 text-center bg-[#14171F] rounded-2xl border border-[#2A303C] text-[#94A3B8] text-xs">
              No announcements published yet.
            </div>
          ) : (
            announcements.map((a) => (
              <div
                key={a.id}
                className={clsx(
                  'p-4 bg-[#14171F] border rounded-2xl shadow-lg space-y-2',
                  a.isUrgent ? 'border-amber-500/50' : 'border-[#2A303C]'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {a.isUrgent && (
                      <span className="px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-500/40 text-[9px] font-bold uppercase tracking-wider">
                        URGENT ALERT
                      </span>
                    )}
                    <h3 className="text-sm font-bold text-[#F8F9FA]">{a.title}</h3>
                  </div>

                  <span className="text-[10px] text-[#94A3B8] font-mono shrink-0">
                    {new Date(a.publishedAt).toLocaleDateString('en-IN', {
                      timeZone: 'Asia/Kolkata',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                <p className="text-xs text-[#94A3B8] leading-relaxed whitespace-pre-line">
                  {a.content}
                </p>

                <div className="pt-2 border-t border-[#2A303C] flex items-center justify-between text-[11px] text-[#94A3B8]">
                  <span>Published by {a.createdBy.fullName}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
