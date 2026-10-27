'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  Users, 
  Search, 
  UserPlus, 
  Calendar, 
  ShieldAlert, 
  CheckCircle2, 
  Clock, 
  Copy, 
  Check, 
  Loader2, 
  X,
  MoreVertical,
  Flame,
  ArrowRight,
  MessageCircle
} from 'lucide-react';
import clsx from 'clsx';
import { WhatsAppRenewalModal } from './WhatsAppRenewalModal.tsx';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '../../../presentation/security/cookie-constants.ts';

interface MemberItem {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
  role: string;
  status: string;
  emailVerifiedAt: string | null;
  createdAt: string;
  totalVisits: number;
  streak: { current: number; longest: number };
  membership: {
    id: string;
    planName: string;
    startDate: string;
    expiryDate: string;
    adminStatus: string;
    derivedStatus?: string;
    daysRemaining?: number;
    suspensionReason?: string | null;
  } | null;
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
  return match ? decodeURIComponent(match[3]) : null;
}

function MembersContent() {
  const searchParams = useSearchParams();
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // Invite Modal
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [invitePlan, setInvitePlan] = useState('General Training');
  const [inviteStartDate, setInviteStartDate] = useState('');
  const [inviteExpiryDate, setInviteExpiryDate] = useState('');
  const [inviting, setInviting] = useState(false);
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Membership Action Modal
  const [selectedMember, setSelectedMember] = useState<MemberItem | null>(null);
  const [actionType, setActionType] = useState<'RENEW' | 'SUSPEND' | 'FREEZE' | 'ACTIVATE'>('RENEW');
  const [newExpiryDate, setNewExpiryDate] = useState('');
  const [actionReason, setActionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // WhatsApp Renewal Modal
  const [whatsAppMember, setWhatsAppMember] = useState<MemberItem | null>(null);

  useEffect(() => {
    if (searchParams.get('invite') === 'true') {
      setShowInviteModal(true);
    }
    const initialStatus = searchParams.get('status');
    if (initialStatus) {
      setStatusFilter(initialStatus);
    }
    // Set default dates for invite
    const now = new Date();
    const start = now.toISOString().slice(0, 10);
    const expDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const expiry = expDate.toISOString().slice(0, 10);
    setInviteStartDate(start);
    setInviteExpiryDate(expiry);
    setNewExpiryDate(expiry);
  }, [searchParams]);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (search) query.set('search', search);
      if (statusFilter && statusFilter !== 'EXPIRING_SOON') {
        query.set('status', statusFilter);
      }

      const res = await fetch(`/api/admin/members?${query.toString()}`);
      if (res.ok) {
        const data = await res.json();
        let list: MemberItem[] = data.data || [];
        if (statusFilter === 'EXPIRING_SOON') {
          list = list.filter(
            (m) =>
              m.membership &&
              m.membership.daysRemaining !== undefined &&
              m.membership.daysRemaining <= 7 &&
              m.membership.daysRemaining >= 0
          );
        }
        setMembers(list);
      }
    } catch (err) {
      console.error('Failed to load members:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, [search, statusFilter]);

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    setInviteError(null);
    setGeneratedInviteUrl(null);

    try {
      const csrfToken = getCookie(CSRF_COOKIE_NAME) || '';
      const res = await fetch('/api/admin/invitations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [CSRF_HEADER_NAME]: csrfToken,
        },
        body: JSON.stringify({
          email: inviteEmail,
          fullName: inviteName,
          phone: invitePhone || undefined,
          planName: invitePlan,
          startDate: inviteStartDate,
          expiryDate: inviteExpiryDate,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create invitation.');
      }

      setGeneratedInviteUrl(data.data.inviteUrl);
      loadMembers();
    } catch (err: unknown) {
      setInviteError(err instanceof Error ? err.message : 'Error creating invitation.');
    } finally {
      setInviting(false);
    }
  };

  const handleCopyInvite = () => {
    if (generatedInviteUrl) {
      navigator.clipboard.writeText(generatedInviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleMembershipAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember || !selectedMember.membership) return;

    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const csrfToken = getCookie(CSRF_COOKIE_NAME) || '';
      const res = await fetch('/api/admin/memberships/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [CSRF_HEADER_NAME]: csrfToken,
        },
        body: JSON.stringify({
          membershipId: selectedMember.membership.id,
          action: actionType,
          newExpiryDate: actionType === 'RENEW' ? newExpiryDate : undefined,
          reason: actionReason,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Membership update failed.');
      }

      setActionSuccess(data.data.message || 'Updated successfully.');
      setTimeout(() => {
        setSelectedMember(null);
        setActionSuccess(null);
        loadMembers();
      }, 1200);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Update failed.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#F8F9FA]">
            Member Registry & Management
          </h1>
          <p className="text-xs text-[#94A3B8] mt-0.5">
            Audit-logged membership lifecycle: Invitations, renewals, suspensions, and access validity.
          </p>
        </div>

        <button
          onClick={() => {
            setShowInviteModal(true);
            setGeneratedInviteUrl(null);
            setInviteError(null);
          }}
          className="px-4 py-2.5 bg-[#CADA03] hover:bg-[#B8C702] text-[#0A0B0E] font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(202,218,3,0.3)] transition shrink-0 uppercase"
        >
          <UserPlus className="w-4 h-4 text-[#0A0B0E]" />
          <span>Invite New Member</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email..."
            className="w-full pl-10 pr-4 py-2.5 bg-[#14171F] border border-[#2A303C] focus:border-[#CADA03] rounded-xl text-[#F8F9FA] placeholder-[#94A3B8]/50 outline-none text-xs"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
          {[
            { id: '', label: 'ALL MEMBERS' },
            { id: 'EXPIRING_SOON', label: 'EXPIRING SOON (7D)' },
            { id: 'ACTIVE', label: 'ACTIVE' },
            { id: 'PENDING_VERIFICATION', label: 'PENDING' },
            { id: 'INVITED', label: 'INVITED' },
            { id: 'SUSPENDED', label: 'SUSPENDED' },
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setStatusFilter(st.id)}
              className={clsx(
                'px-3 py-2 rounded-xl font-bold whitespace-nowrap transition text-[11px]',
                statusFilter === st.id
                  ? st.id === 'EXPIRING_SOON'
                    ? 'bg-amber-950/60 text-amber-400 border border-amber-500/50 shadow-[0_2px_8px_rgba(251,191,36,0.25)]'
                    : 'bg-[#1D222E] text-[#CADA03] border border-[#CADA03]/40 shadow-[0_2px_8px_rgba(202,218,3,0.25)]'
                  : 'bg-[#14171F] text-[#94A3B8] hover:text-[#F8F9FA] border border-[#2A303C]'
              )}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* Members Table */}
      <div className="bg-[#14171F] border border-[#2A303C] rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#94A3B8]">
            <thead className="bg-[#0A0B0E] text-[#94A3B8] uppercase text-[10px] tracking-wider border-b border-[#2A303C]">
              <tr>
                <th className="py-3 px-4">Member Name</th>
                <th className="py-3 px-4">Account Status</th>
                <th className="py-3 px-4">Plan & Expiry</th>
                <th className="py-3 px-4">Streak & Visits</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2A303C]/70">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[#94A3B8]">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#CADA03]" />
                    <span>Loading members...</span>
                  </td>
                </tr>
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[#94A3B8]">
                    No members found matching filter criteria.
                  </td>
                </tr>
              ) : (
                members.map((m) => (
                  <tr key={m.id} className="hover:bg-[#1D222E]/50 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-[#F8F9FA]">{m.fullName}</div>
                      <div className="text-[11px] text-[#94A3B8] font-mono">{m.email}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={clsx(
                          'inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider',
                          m.status === 'ACTIVE'
                            ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-400'
                            : m.status === 'PENDING_VERIFICATION'
                            ? 'bg-amber-950/60 border border-amber-500/40 text-amber-400'
                            : m.status === 'INVITED'
                            ? 'bg-blue-950/60 border border-blue-500/40 text-blue-400'
                            : 'bg-red-950/60 border border-red-500/40 text-red-400'
                        )}
                      >
                        {m.status.replace('_', ' ')}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      {m.membership ? (
                        <div>
                          <div className="font-semibold text-[#F8F9FA]">{m.membership.planName}</div>
                          <div className="text-[11px] text-[#94A3B8] flex items-center gap-1 mt-0.5">
                            <span>Exp: <strong className="text-[#F8F9FA] font-mono">{m.membership.expiryDate}</strong></span>
                            {m.membership.daysRemaining !== undefined && (
                              <span className={clsx('text-[10px]', m.membership.daysRemaining <= 7 ? 'text-amber-400 font-bold' : 'text-[#94A3B8]')}>
                                ({m.membership.daysRemaining}d left)
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-[#94A3B8] italic">No plan assigned</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 text-[#CADA03] font-bold">
                          <Flame className="w-3.5 h-3.5" />
                          <span>{m.streak.current}d</span>
                        </div>
                        <span className="text-[#94A3B8]">•</span>
                        <span>{m.totalVisits} visits</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {m.membership && (
                          <button
                            onClick={() => setWhatsAppMember(m)}
                            className="p-1.5 bg-[#25D366]/15 hover:bg-[#25D366]/30 border border-[#25D366]/40 text-[#25D366] rounded-xl transition flex items-center gap-1"
                            title="Compose 1-Click WhatsApp Renewal Reminder"
                          >
                            <MessageCircle className="w-4 h-4 text-[#25D366]" />
                            <span className="hidden xl:inline text-[10px] font-bold">WhatsApp</span>
                          </button>
                        )}

                        {m.membership && (
                          <button
                            onClick={() => {
                              setSelectedMember(m);
                              setActionType('RENEW');
                              setActionError(null);
                              setActionSuccess(null);
                              setActionReason('');
                            }}
                            className="px-2.5 py-1.5 bg-[#1D222E] hover:bg-[#2A303C] text-[#CADA03] hover:text-white rounded-xl text-[11px] font-bold border border-[#2A303C] transition"
                          >
                            Manage Plan
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#14171F] border border-[#2A303C] rounded-2xl p-6 shadow-2xl relative">
            <button
              onClick={() => setShowInviteModal(false)}
              className="absolute top-4 right-4 text-[#94A3B8] hover:text-[#F8F9FA]"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <UserPlus className="w-5 h-5 text-[#FF5500]" />
              <h2 className="text-lg font-bold text-[#F8F9FA]">Generate Member Invitation</h2>
            </div>

            {inviteError && (
              <div className="mb-4 p-3 bg-red-950/40 border border-red-500/40 rounded-xl text-red-200 text-xs">
                {inviteError}
              </div>
            )}

            {generatedInviteUrl ? (
              <div className="space-y-4 py-2">
                <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-xs text-emerald-300">
                  Invitation created! The link below is single-use and valid for 7 days.
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                    Single-Use Invitation URL
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={generatedInviteUrl}
                      className="w-full px-3 py-2 bg-[#0A0B0E] border border-[#2A303C] rounded-xl text-xs text-[#F8F9FA] font-mono outline-none"
                    />
                    <button
                      onClick={handleCopyInvite}
                      className="px-3 py-2 bg-[#FF5500] hover:bg-[#E04B00] text-white font-bold rounded-xl text-xs flex items-center gap-1 shrink-0"
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                <p className="text-xs text-[#94A3B8] leading-relaxed">
                  Share this link with the athlete via WhatsApp or approved channels. The member will set their password and verify their email to complete activation.
                </p>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => setShowInviteModal(false)}
                    className="px-4 py-2 bg-[#1D222E] hover:bg-[#2A303C] text-xs font-bold text-[#F8F9FA] rounded-xl"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateInvite} className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                    Athlete Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full px-3 py-2 bg-[#0A0B0E] border border-[#2A303C] focus:border-[#FF5500] rounded-xl text-xs text-[#F8F9FA] outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="athlete@example.com"
                      className="w-full px-3 py-2 bg-[#0A0B0E] border border-[#2A303C] focus:border-[#FF5500] rounded-xl text-xs text-[#F8F9FA] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                      Phone (Optional)
                    </label>
                    <input
                      type="text"
                      value={invitePhone}
                      onChange={(e) => setInvitePhone(e.target.value)}
                      placeholder="+919876543210"
                      className="w-full px-3 py-2 bg-[#0A0B0E] border border-[#2A303C] focus:border-[#FF5500] rounded-xl text-xs text-[#F8F9FA] outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                    Membership Plan *
                  </label>
                  <input
                    type="text"
                    required
                    value={invitePlan}
                    onChange={(e) => setInvitePlan(e.target.value)}
                    placeholder="e.g. General Training (CrossFit & HYROX)"
                    className="w-full px-3 py-2 bg-[#0A0B0E] border border-[#2A303C] focus:border-[#FF5500] rounded-xl text-xs text-[#F8F9FA] outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                      Start Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={inviteStartDate}
                      onChange={(e) => setInviteStartDate(e.target.value)}
                      className="w-full px-3 py-2 bg-[#0A0B0E] border border-[#2A303C] focus:border-[#FF5500] rounded-xl text-xs text-[#F8F9FA] outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                      Expiry Date (Inclusive) *
                    </label>
                    <input
                      type="date"
                      required
                      value={inviteExpiryDate}
                      onChange={(e) => setInviteExpiryDate(e.target.value)}
                      className="w-full px-3 py-2 bg-[#0A0B0E] border border-[#2A303C] focus:border-[#CADA03] rounded-xl text-xs text-[#F8F9FA] outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="px-4 py-2 bg-[#1D222E] hover:bg-[#2A303C] text-xs font-bold text-[#F8F9FA] rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={inviting}
                    className="px-4 py-2 bg-[#CADA03] hover:bg-[#B8C702] text-xs font-black text-[#0A0B0E] rounded-xl flex items-center gap-1.5 disabled:opacity-50 uppercase"
                  >
                    {inviting && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0A0B0E]" />}
                    <span>Generate Secure Link</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Manage Membership Modal */}
      {selectedMember && selectedMember.membership && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#14171F] border border-[#2A303C] rounded-2xl p-6 shadow-2xl relative">
            <button
              onClick={() => setSelectedMember(null)}
              className="absolute top-4 right-4 text-[#94A3B8] hover:text-[#F8F9FA]"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-bold text-[#F8F9FA] mb-1">
              Manage Membership: {selectedMember.fullName}
            </h2>
            <p className="text-xs text-[#94A3B8] mb-4 font-mono">
              Current Plan: {selectedMember.membership.planName} (Exp: {selectedMember.membership.expiryDate})
            </p>

            {/* Quick WhatsApp Reminder Action */}
            <div className="mb-4 p-3.5 bg-[#0A0B0E] border border-[#25D366]/35 rounded-2xl flex items-center justify-between shadow-inner">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#25D366]/15 flex items-center justify-center text-[#25D366]">
                  <MessageCircle className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#F8F9FA]">WhatsApp Renewal Prompt</div>
                  <div className="text-[10px] text-[#94A3B8]">Send pre-filled renewal notice to {selectedMember.fullName.split(' ')[0]}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWhatsAppMember(selectedMember)}
                className="px-3 py-1.5 bg-[#25D366] hover:bg-[#20BD5A] text-[#0A0B0E] font-black rounded-xl text-[10px] uppercase flex items-center gap-1.5 transition shadow-[0_2px_8px_rgba(37,211,102,0.3)]"
              >
                <span>Compose</span>
              </button>
            </div>

            {actionError && (
              <div className="mb-4 p-3 bg-red-950/40 border border-red-500/40 rounded-xl text-red-200 text-xs">
                {actionError}
              </div>
            )}
            {actionSuccess && (
              <div className="mb-4 p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-emerald-200 text-xs">
                {actionSuccess}
              </div>
            )}

            <form onSubmit={handleMembershipAction} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                  Administrative Action
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['RENEW', 'SUSPEND', 'FREEZE', 'ACTIVATE'] as const).map((act) => (
                    <button
                      type="button"
                      key={act}
                      onClick={() => setActionType(act)}
                      className={clsx(
                        'py-2 rounded-xl text-[11px] font-bold border transition uppercase',
                        actionType === act
                          ? 'bg-[#CADA03] text-[#0A0B0E] border-[#CADA03] font-black shadow-[0_2px_8px_rgba(202,218,3,0.3)]'
                          : 'bg-[#0A0B0E] text-[#94A3B8] border-[#2A303C] hover:text-[#F8F9FA]'
                      )}
                    >
                      {act}
                    </button>
                  ))}
                </div>
              </div>

              {actionType === 'RENEW' && (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                    New Expiry Date (Inclusive) *
                  </label>
                  <input
                    type="date"
                    required
                    value={newExpiryDate}
                    onChange={(e) => setNewExpiryDate(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0A0B0E] border border-[#2A303C] focus:border-[#CADA03] rounded-xl text-xs text-[#F8F9FA] outline-none font-mono"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                  Mandatory Audit Reason *
                </label>
                <textarea
                  required
                  rows={2}
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="e.g. Paid in full for monthly renewal at reception; or Suspended per athlete medical leave."
                  className="w-full px-3 py-2 bg-[#0A0B0E] border border-[#2A303C] focus:border-[#CADA03] rounded-xl text-xs text-[#F8F9FA] outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedMember(null)}
                  className="px-4 py-2 bg-[#1D222E] hover:bg-[#2A303C] text-xs font-bold text-[#F8F9FA] rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !actionReason}
                  className="px-4 py-2 bg-[#CADA03] hover:bg-[#B8C702] text-xs font-black text-[#0A0B0E] rounded-xl flex items-center gap-1.5 disabled:opacity-50 uppercase"
                >
                  {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0A0B0E]" />}
                  <span>Apply & Audit Log</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WhatsApp Renewal Generator Modal */}
      <WhatsAppRenewalModal
        isOpen={!!whatsAppMember}
        onClose={() => setWhatsAppMember(null)}
        member={whatsAppMember}
      />
    </div>
  );
}

export default function MembersPage() {
  return (
    <Suspense fallback={<div className="text-xs text-muted">Loading members registry...</div>}>
      <MembersContent />
    </Suspense>
  );
}
