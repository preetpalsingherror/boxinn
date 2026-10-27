'use client';

import { useState, useMemo } from 'react';
import { 
  X, 
  Send, 
  Copy, 
  Check, 
  Phone, 
  Calendar, 
  Sparkles, 
  Clock, 
  Dumbbell, 
  MessageCircle,
  ExternalLink
} from 'lucide-react';

export interface WhatsAppMember {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
  membership?: {
    planName: string;
    expiryDate: string;
    daysRemaining?: number;
    derivedStatus?: string;
  } | null;
  streak?: {
    current: number;
    longest: number;
  };
}

interface WhatsAppRenewalModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: WhatsAppMember | null;
}

export function WhatsAppRenewalModal({ isOpen, onClose, member }: WhatsAppRenewalModalProps) {
  const [templateType, setTemplateType] = useState<'friendly' | 'urgent' | 'expired' | 'custom'>('friendly');
  const [phoneInput, setPhoneInput] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [copied, setCopied] = useState(false);

  // Sync phone number when member changes
  useMemo(() => {
    if (member?.phone) {
      setPhoneInput(member.phone);
    } else {
      setPhoneInput('+91');
    }
  }, [member]);

  // Clean phone number for WhatsApp API (digits only, e.g. 919876543210)
  const cleanPhone = useMemo(() => {
    const digits = phoneInput.replace(/\D/g, '');
    if (digits.length === 10) {
      return `91${digits}`;
    }
    return digits;
  }, [phoneInput]);

  // Generate templates based on member data
  const generatedMessage = useMemo(() => {
    if (!member) return '';

    const firstName = member.fullName.split(' ')[0] || 'Athlete';
    const plan = member.membership?.planName || 'Training Package';
    const expiry = member.membership?.expiryDate || 'soon';
    const daysLeft = member.membership?.daysRemaining;
    const streak = member.streak?.current || 0;

    const streakNotice = streak > 1 
      ? ` Don't let your *${streak}-day consistency streak* break! 🔥` 
      : '';

    switch (templateType) {
      case 'urgent':
        return `Hey ${firstName}! ⚡ Quick reminder from *BOX INN Yelahanka*:\n\nYour *${plan}* pass expires ${daysLeft === 0 ? '*today*' : daysLeft === 1 ? '*tomorrow*' : `in *${daysLeft} days*`} (${expiry}).${streakNotice}\n\nReply to this message or visit the front desk today to lock in your next training block. Let's keep the momentum going! 💪\n\n_Rise Above The Average_ 🥊`;

      case 'expired':
        return `Hi ${firstName}! 👋 Greetings from *BOX INN Gym, Yelahanka*.\n\nWe noticed your *${plan}* expired on *${expiry}*. We miss having you on the gym floor!\n\nWe've set up new equipment and conditioning blocks this month. Reply here to reactivate your athlete pass with zero re-registration fee. See you on the floor! 🏋️‍♂️`;

      case 'custom':
        return customMessage || `Hi ${firstName}, reminder regarding your BOX INN membership renewal.`;

      case 'friendly':
      default:
        return `Hi ${firstName}! 👋 Greetings from *BOX INN Yelahanka*.\n\nYour *${plan}* membership is scheduled for renewal in *${daysLeft !== undefined ? `${daysLeft} days` : 'a few days'}* on *${expiry}*.${streakNotice}\n\nWould you like us to prepare your renewal invoice for the upcoming month? Reply to this message or stop by the front desk after your next session.\n\n_Rise Above The Average_ 🥊\n*BOX INN Yelahanka*`;
    }
  }, [member, templateType, customMessage]);

  if (!isOpen || !member) return null;

  const handleOpenWhatsApp = () => {
    if (!cleanPhone || cleanPhone.length < 10) {
      alert('Please enter a valid phone number with country code (e.g. +91 98765 43210).');
      return;
    }
    const encoded = encodeURIComponent(generatedMessage);
    const url = `https://wa.me/${cleanPhone}?text=${encoded}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-xl bg-[#14171F] border border-[#2A303C] rounded-3xl p-6 shadow-2xl relative my-8">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-[#94A3B8] hover:text-[#F8F9FA] p-1.5 rounded-xl hover:bg-[#1D222E] transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-[#25D366]/15 border border-[#25D366]/30 flex items-center justify-center text-[#25D366]">
            <MessageCircle className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-[#25D366]/20 border border-[#25D366]/40 text-[#25D366] text-[10px] font-black uppercase tracking-wider">
                WhatsApp Connect
              </span>
              <h2 className="text-base sm:text-lg font-black text-[#F8F9FA]">
                1-Click Renewal Prompt
              </h2>
            </div>
            <p className="text-xs text-[#94A3B8] mt-0.5">
              Send personalized membership renewal notices directly to athlete WhatsApp.
            </p>
          </div>
        </div>

        {/* Member Summary Card */}
        <div className="p-3.5 bg-[#0A0B0E] border border-[#2A303C] rounded-2xl mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-[#F8F9FA]">{member.fullName}</div>
            <div className="text-xs text-[#94A3B8] flex items-center gap-2 mt-0.5">
              <span>{member.membership?.planName || 'Active Athlete'}</span>
              <span>•</span>
              <span>Exp: <strong className="text-[#F8F9FA] font-mono">{member.membership?.expiryDate || 'N/A'}</strong></span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {member.membership?.daysRemaining !== undefined && (
              <span className={`px-2.5 py-1 rounded-xl text-xs font-bold font-mono ${
                member.membership.daysRemaining <= 3 
                  ? 'bg-amber-950/60 border border-amber-500/40 text-amber-400' 
                  : 'bg-[#1D222E] text-[#94A3B8]'
              }`}>
                {member.membership.daysRemaining <= 0 ? 'Expired' : `${member.membership.daysRemaining}d left`}
              </span>
            )}
          </div>
        </div>

        {/* Phone Input */}
        <div className="mb-4">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5 flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5 text-[#25D366]" />
            <span>Athlete WhatsApp Number</span>
          </label>
          <input
            type="text"
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            placeholder="+91 98765 43210"
            className="w-full px-3.5 py-2.5 bg-[#0A0B0E] border border-[#2A303C] focus:border-[#25D366] rounded-xl text-xs font-mono text-[#F8F9FA] outline-none transition"
          />
        </div>

        {/* Template Selection Tabs */}
        <div className="mb-4">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
            Select Message Tone &amp; Urgency
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => setTemplateType('friendly')}
              className={`py-2 px-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition ${
                templateType === 'friendly'
                  ? 'bg-[#CADA03] text-[#0A0B0E] shadow-[0_2px_8px_rgba(202,218,3,0.3)]'
                  : 'bg-[#1D222E] text-[#94A3B8] hover:text-[#F8F9FA]'
              }`}
            >
              Friendly (3-7d)
            </button>

            <button
              type="button"
              onClick={() => setTemplateType('urgent')}
              className={`py-2 px-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition ${
                templateType === 'urgent'
                  ? 'bg-amber-400 text-[#0A0B0E] shadow-[0_2px_8px_rgba(251,191,36,0.3)]'
                  : 'bg-[#1D222E] text-[#94A3B8] hover:text-[#F8F9FA]'
              }`}
            >
              Urgent (&lt;2d)
            </button>

            <button
              type="button"
              onClick={() => setTemplateType('expired')}
              className={`py-2 px-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition ${
                templateType === 'expired'
                  ? 'bg-red-500 text-white shadow-[0_2px_8px_rgba(239,68,68,0.3)]'
                  : 'bg-[#1D222E] text-[#94A3B8] hover:text-[#F8F9FA]'
              }`}
            >
              Win-Back
            </button>

            <button
              type="button"
              onClick={() => {
                setTemplateType('custom');
                if (!customMessage) setCustomMessage(generatedMessage);
              }}
              className={`py-2 px-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition ${
                templateType === 'custom'
                  ? 'bg-blue-500 text-white shadow-[0_2px_8px_rgba(59,130,246,0.3)]'
                  : 'bg-[#1D222E] text-[#94A3B8] hover:text-[#F8F9FA]'
              }`}
            >
              Custom
            </button>
          </div>
        </div>

        {/* Custom Edit Area (if custom) */}
        {templateType === 'custom' && (
          <div className="mb-4">
            <textarea
              rows={4}
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              className="w-full p-3 bg-[#0A0B0E] border border-[#2A303C] focus:border-[#CADA03] rounded-xl text-xs text-[#F8F9FA] outline-none"
              placeholder="Type custom WhatsApp notice here..."
            />
          </div>
        )}

        {/* WhatsApp Chat Preview Bubble */}
        <div className="mb-5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5 flex items-center justify-between">
            <span>WhatsApp Preview</span>
            <span className="text-emerald-400 font-mono text-[9px]">End-to-End Encrypted</span>
          </div>

          <div className="p-4 bg-[#0B141A] rounded-2xl border border-[#2A303C] shadow-inner relative">
            <div className="max-w-md ml-auto bg-[#005C4B] text-[#E9EDEF] rounded-2xl rounded-tr-none p-3.5 text-xs shadow-md whitespace-pre-line leading-relaxed">
              {generatedMessage}
              <div className="text-[9px] text-[#8696A0] text-right mt-1.5 flex items-center justify-end gap-1">
                <span>Just now</span>
                <span className="text-[#53BDEB] font-bold">✓✓</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={handleCopy}
            className="px-4 py-2.5 bg-[#1D222E] hover:bg-[#2A303C] text-[#94A3B8] hover:text-[#F8F9FA] rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied to Clipboard' : 'Copy Text'}</span>
          </button>

          <button
            type="button"
            onClick={handleOpenWhatsApp}
            className="px-5 py-2.5 bg-[#25D366] hover:bg-[#20BD5A] text-[#0A0B0E] font-black rounded-xl text-xs flex items-center gap-2 shadow-[0_4px_16px_rgba(37,211,102,0.35)] transition uppercase"
          >
            <Send className="w-4 h-4 text-[#0A0B0E]" />
            <span>Open WhatsApp Now</span>
          </button>
        </div>
      </div>
    </div>
  );
}
