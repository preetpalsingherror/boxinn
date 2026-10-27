'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Dumbbell, 
  Plus, 
  MapPin, 
  QrCode, 
  X, 
  Loader2, 
  Video, 
  Copy, 
  Check,
  ExternalLink,
  BookOpen
} from 'lucide-react';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '../../../presentation/security/cookie-constants.ts';

interface MachineItem {
  id: string;
  code: string;
  name: string;
  category: string;
  location: string;
  description: string;
  _count: { exercises: number };
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
  return match ? decodeURIComponent(match[3]) : null;
}

export default function AdminMachinesPage() {
  const [machines, setMachines] = useState<MachineItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Machine Modal
  const [showAddMachine, setShowAddMachine] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Conditioning / HYROX');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [machineSubmitting, setMachineSubmitting] = useState(false);
  const [machineError, setMachineError] = useState<string | null>(null);

  // Add Exercise Guide Modal
  const [selectedMachineForGuide, setSelectedMachineForGuide] = useState<MachineItem | null>(null);
  const [guideTitle, setGuideTitle] = useState('');
  const [targetMuscles, setTargetMuscles] = useState('');
  const [instructions, setInstructions] = useState('');
  const [formCues, setFormCues] = useState('');
  const [safety, setSafety] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [trainerName, setTrainerName] = useState('Coach Vikram');
  const [guideSubmitting, setGuideSubmitting] = useState(false);
  const [guideError, setGuideError] = useState<string | null>(null);

  // QR preview state
  const [previewQrCode, setPreviewQrCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadMachines = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/machines');
      if (res.ok) {
        const data = await res.json();
        setMachines(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load machines:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMachines();
  }, []);

  const handleCreateMachine = async (e: React.FormEvent) => {
    e.preventDefault();
    setMachineSubmitting(true);
    setMachineError(null);

    try {
      const csrfToken = getCookie(CSRF_COOKIE_NAME) || '';
      const res = await fetch('/api/machines', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [CSRF_HEADER_NAME]: csrfToken,
        },
        body: JSON.stringify({
          code,
          name,
          category,
          location,
          description,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to add machine.');
      }

      setShowAddMachine(false);
      setCode('');
      setName('');
      setLocation('');
      setDescription('');
      loadMachines();
    } catch (err: unknown) {
      setMachineError(err instanceof Error ? err.message : 'Error adding machine.');
    } finally {
      setMachineSubmitting(false);
    }
  };

  const handleAddGuide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMachineForGuide) return;

    setGuideSubmitting(true);
    setGuideError(null);

    try {
      const csrfToken = getCookie(CSRF_COOKIE_NAME) || '';
      const cuesList = formCues.split('\n').map((c) => c.trim()).filter(Boolean);

      const res = await fetch(`/api/machines/${selectedMachineForGuide.code}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [CSRF_HEADER_NAME]: csrfToken,
        },
        body: JSON.stringify({
          title: guideTitle,
          targetMuscleGroup: targetMuscles,
          instructions,
          formCues: cuesList,
          safetyPrecautions: safety,
          videoUrl: videoUrl || null,
          trainerName,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to add exercise guide.');
      }

      setSelectedMachineForGuide(null);
      setGuideTitle('');
      setTargetMuscles('');
      setInstructions('');
      setFormCues('');
      setSafety('');
      setVideoUrl('');
      loadMachines();
    } catch (err: unknown) {
      setGuideError(err instanceof Error ? err.message : 'Error adding exercise.');
    } finally {
      setGuideSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#F8F9FA]">
            Equipment Stations & Exercise Guides
          </h1>
          <p className="text-xs text-[#94A3B8] mt-0.5">
            Manage QR-accessible machine stations and attach trainer-curated movement instructions.
          </p>
        </div>

        <button
          onClick={() => setShowAddMachine(true)}
          className="px-4 py-2.5 bg-[#CADA03] hover:bg-[#B8C702] text-[#0A0B0E] font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(202,218,3,0.3)] transition shrink-0 uppercase"
        >
          <Plus className="w-4 h-4 text-[#0A0B0E]" />
          <span>Add Machine Station</span>
        </button>
      </div>

      {/* Machines List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-2 py-12 text-center text-[#94A3B8]">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#CADA03]" />
            <span>Loading equipment...</span>
          </div>
        ) : machines.length === 0 ? (
          <div className="col-span-2 py-12 text-center text-[#94A3B8] bg-[#14171F] rounded-2xl border border-[#2A303C]">
            No equipment registered yet.
          </div>
        ) : (
          machines.map((m) => (
            <div
              key={m.id}
              className="p-5 bg-[#14171F] border border-[#2A303C] rounded-2xl flex flex-col justify-between shadow-xl"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-[#CADA03]/15 border border-[#CADA03]/40 text-[10px] font-bold text-[#CADA03] font-mono">
                      {m.code}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                      {m.category}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      setPreviewQrCode(m.code);
                      setCopied(false);
                    }}
                    className="p-1.5 rounded-lg bg-[#1D222E] hover:bg-[#2A303C] text-[#94A3B8] hover:text-[#CADA03] transition"
                    title="View QR Code Link"
                  >
                    <QrCode className="w-4 h-4" />
                  </button>
                </div>

                <h3 className="text-base font-bold text-[#F8F9FA] mt-2">
                  {m.name}
                </h3>
                <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed">
                  {m.description}
                </p>

                <div className="flex items-center gap-1.5 text-xs text-[#94A3B8] mt-3">
                  <MapPin className="w-3.5 h-3.5 text-[#CADA03]" />
                  <span>{m.location}</span>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-[#2A303C] flex items-center justify-between">
                <span className="text-xs font-semibold text-[#F8F9FA]">
                  {m._count.exercises} {m._count.exercises === 1 ? 'Exercise Guide' : 'Exercise Guides'}
                </span>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/machines/${m.code}`}
                    className="px-2.5 py-1.5 bg-[#1D222E] hover:bg-[#2A303C] text-xs font-semibold text-[#F8F9FA] rounded-lg transition flex items-center gap-1"
                  >
                    <span>Preview</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>

                  <button
                    onClick={() => {
                      setSelectedMachineForGuide(m);
                      setGuideError(null);
                    }}
                    className="px-2.5 py-1.5 bg-[#CADA03] hover:bg-[#B8C702] text-xs font-black text-[#0A0B0E] rounded-lg transition flex items-center gap-1 uppercase"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#0A0B0E]" />
                    <span>Add Guide</span>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Machine Modal */}
      {showAddMachine && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#14171F] border border-[#2A303C] rounded-2xl p-6 shadow-2xl relative">
            <button
              onClick={() => setShowAddMachine(false)}
              className="absolute top-4 right-4 text-[#94A3B8] hover:text-[#F8F9FA]"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-bold text-[#F8F9FA] mb-4">
              Register Equipment Station
            </h2>

            {machineError && (
              <div className="mb-4 p-3 bg-red-950/40 border border-red-500/40 rounded-xl text-red-200 text-xs">
                {machineError}
              </div>
            )}

            <form onSubmit={handleCreateMachine} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                    Machine Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="e.g. M-SKI-01"
                    className="w-full px-3 py-2 bg-[#0A0B0E] border border-[#2A303C] focus:border-[#CADA03] rounded-xl text-xs text-[#F8F9FA] outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                    Category *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0A0B0E] border border-[#2A303C] focus:border-[#CADA03] rounded-xl text-xs text-[#F8F9FA] outline-none"
                  >
                    <option value="Conditioning / HYROX">Conditioning / HYROX</option>
                    <option value="Strength / Weightlifting">Strength / Weightlifting</option>
                    <option value="Functional / Rig">Functional / Rig</option>
                    <option value="Recovery / Mobility">Recovery / Mobility</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                  Machine Display Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Concept2 SkiErg Station"
                  className="w-full px-3 py-2 bg-[#0A0B0E] border border-[#2A303C] focus:border-[#CADA03] rounded-xl text-xs text-[#F8F9FA] outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                  Gym Floor Location *
                </label>
                <input
                  type="text"
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Cardio & HYROX Zone, Bay 2"
                  className="w-full px-3 py-2 bg-[#0A0B0E] border border-[#2A303C] focus:border-[#CADA03] rounded-xl text-xs text-[#F8F9FA] outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                  Description *
                </label>
                <textarea
                  required
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief apparatus summary and purpose..."
                  className="w-full px-3 py-2 bg-[#0A0B0E] border border-[#2A303C] focus:border-[#CADA03] rounded-xl text-xs text-[#F8F9FA] outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddMachine(false)}
                  className="px-4 py-2 bg-[#1D222E] hover:bg-[#2A303C] text-xs font-bold text-[#F8F9FA] rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={machineSubmitting}
                  className="px-4 py-2 bg-[#CADA03] hover:bg-[#B8C702] text-xs font-black text-[#0A0B0E] rounded-xl flex items-center gap-1.5 disabled:opacity-50 uppercase"
                >
                  {machineSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0A0B0E]" />}
                  <span>Save Machine</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Exercise Guide Modal */}
      {selectedMachineForGuide && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-[#14171F] border border-[#2A303C] rounded-2xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSelectedMachineForGuide(null)}
              className="absolute top-4 right-4 text-[#94A3B8] hover:text-[#F8F9FA]"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-bold text-[#F8F9FA] mb-1">
              Add Exercise Guide to {selectedMachineForGuide.name}
            </h2>
            <p className="text-xs text-[#94A3B8] mb-4 font-mono">
              Station Code: {selectedMachineForGuide.code}
            </p>

            {guideError && (
              <div className="mb-4 p-3 bg-red-950/40 border border-red-500/40 rounded-xl text-red-200 text-xs">
                {guideError}
              </div>
            )}

            <form onSubmit={handleAddGuide} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                    Exercise Movement Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={guideTitle}
                    onChange={(e) => setGuideTitle(e.target.value)}
                    placeholder="e.g. SkiErg Butterfly Pulls"
                    className="w-full px-3 py-2 bg-[#0A0B0E] border border-[#2A303C] focus:border-[#CADA03] rounded-xl text-xs text-[#F8F9FA] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                    Target Muscle Group *
                  </label>
                  <input
                    type="text"
                    required
                    value={targetMuscles}
                    onChange={(e) => setTargetMuscles(e.target.value)}
                    placeholder="e.g. Lats, Core, Triceps"
                    className="w-full px-3 py-2 bg-[#0A0B0E] border border-[#2A303C] focus:border-[#CADA03] rounded-xl text-xs text-[#F8F9FA] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                  Movement Instructions *
                </label>
                <textarea
                  required
                  rows={3}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Step-by-step setup, starting posture, drive phase, and recovery..."
                  className="w-full px-3 py-2 bg-[#0A0B0E] border border-[#2A303C] focus:border-[#CADA03] rounded-xl text-xs text-[#F8F9FA] outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                  Key Form Cues (One per line)
                </label>
                <textarea
                  rows={2}
                  value={formCues}
                  onChange={(e) => setFormCues(e.target.value)}
                  placeholder="Hinge at the hips&#10;Engage core before pulling&#10;High elbows on recovery"
                  className="w-full px-3 py-2 bg-[#0A0B0E] border border-[#2A303C] focus:border-[#CADA03] rounded-xl text-xs text-[#F8F9FA] outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                  Safety Precautions *
                </label>
                <input
                  type="text"
                  required
                  value={safety}
                  onChange={(e) => setSafety(e.target.value)}
                  placeholder="e.g. Avoid rounding the lower back under high cadence fatigue."
                  className="w-full px-3 py-2 bg-[#0A0B0E] border border-[#2A303C] focus:border-[#CADA03] rounded-xl text-xs text-[#F8F9FA] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                    Demo Video URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 bg-[#0A0B0E] border border-[#2A303C] focus:border-[#CADA03] rounded-xl text-xs text-[#F8F9FA] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                    Trainer Name
                  </label>
                  <input
                    type="text"
                    value={trainerName}
                    onChange={(e) => setTrainerName(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0A0B0E] border border-[#2A303C] focus:border-[#CADA03] rounded-xl text-xs text-[#F8F9FA] outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedMachineForGuide(null)}
                  className="px-4 py-2 bg-[#1D222E] hover:bg-[#2A303C] text-xs font-bold text-[#F8F9FA] rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={guideSubmitting}
                  className="px-4 py-2 bg-[#CADA03] hover:bg-[#B8C702] text-xs font-black text-[#0A0B0E] rounded-xl flex items-center gap-1.5 disabled:opacity-50 uppercase"
                >
                  {guideSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0A0B0E]" />}
                  <span>Save Exercise Guide</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Code URL Preview Modal */}
      {previewQrCode && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#14171F] border border-[#2A303C] rounded-2xl p-6 shadow-2xl relative text-center">
            <button
              onClick={() => setPreviewQrCode(null)}
              className="absolute top-4 right-4 text-[#94A3B8] hover:text-[#F8F9FA]"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-xl bg-[#1D222E] border border-[#CADA03]/40 flex items-center justify-center text-[#CADA03] mx-auto mb-3">
              <QrCode className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-[#F8F9FA] mb-1">
              Station QR Code URL
            </h3>
            <p className="text-xs text-[#94A3B8] mb-4">
              Physical sticker URL for equipment code <strong className="text-[#F8F9FA]">{previewQrCode}</strong>
            </p>

            <div className="p-3 bg-[#0A0B0E] border border-[#2A303C] rounded-xl text-xs text-[#CADA03] font-mono break-all mb-4">
              {typeof window !== 'undefined' ? `${window.location.origin}/machines/${previewQrCode}` : `/machines/${previewQrCode}`}
            </div>

            <button
              onClick={() => {
                const url = typeof window !== 'undefined' ? `${window.location.origin}/machines/${previewQrCode}` : `/machines/${previewQrCode}`;
                navigator.clipboard.writeText(url);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="w-full py-2.5 px-4 bg-[#CADA03] hover:bg-[#B8C702] text-[#0A0B0E] font-black rounded-xl text-xs flex items-center justify-center gap-1.5 transition uppercase"
            >
              {copied ? <Check className="w-4 h-4 text-[#0A0B0E]" /> : <Copy className="w-4 h-4 text-[#0A0B0E]" />}
              <span>{copied ? 'Copied to Clipboard' : 'Copy Sticker URL'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
