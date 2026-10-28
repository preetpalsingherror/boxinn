'use client';

import { useState, useEffect } from 'react';
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
  Printer,
  Trash2,
  Edit3,
  CheckCircle2,
  ShieldAlert,
  Sparkles,
  Layers
} from 'lucide-react';
import { EquipmentPrintModal } from './EquipmentPrintModal.tsx';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '../../../presentation/security/cookie-constants.ts';

interface ExerciseItem {
  id: string;
  title: string;
  targetMuscleGroup: string;
  difficulty: string;
  instructions: string;
  formCues: string;
  safetyPrecautions: string;
  videoUrl: string | null;
  trainerName: string;
}

interface MachineItem {
  id: string;
  code: string;
  name: string;
  category: string;
  location: string;
  description: string;
  exercises?: ExerciseItem[];
  _count: { exercises: number };
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
  return match ? decodeURIComponent(match[3]) : null;
}

function normalizeVideoEmbedUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    if (trimmed.includes('youtube.com/embed/') || trimmed.includes('youtube-nocookie.com/embed/')) {
      return trimmed;
    }
    const youtuBeMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
    if (youtuBeMatch && youtuBeMatch[1]) {
      return `https://www.youtube-nocookie.com/embed/${youtuBeMatch[1]}`;
    }
    const ytWatchMatch = trimmed.match(/[?&]v=([a-zA-Z0-9_-]+)/);
    if (ytWatchMatch && ytWatchMatch[1]) {
      return `https://www.youtube-nocookie.com/embed/${ytWatchMatch[1]}`;
    }
    const ytShortsMatch = trimmed.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/);
    if (ytShortsMatch && ytShortsMatch[1]) {
      return `https://www.youtube-nocookie.com/embed/${ytShortsMatch[1]}`;
    }
    const vimeoMatch = trimmed.match(/vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|)(\d+)(?:$|\/|\?)/);
    if (vimeoMatch && (vimeoMatch[3] || vimeoMatch[1])) {
      const vimeoId = vimeoMatch[3] || vimeoMatch[1];
      return `https://player.vimeo.com/video/${vimeoId}`;
    }
    return trimmed;
  } catch {
    return trimmed;
  }
}

export default function AdminMachinesPage() {
  const [machines, setMachines] = useState<MachineItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Add / Edit Machine Modal
  const [showAddMachine, setShowAddMachine] = useState(false);
  const [editingMachineCode, setEditingMachineCode] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Conditioning / HYROX');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [machineSubmitting, setMachineSubmitting] = useState(false);
  const [machineError, setMachineError] = useState<string | null>(null);

  // Delete Machine Confirmation Modal
  const [machineToDelete, setMachineToDelete] = useState<MachineItem | null>(null);
  const [deletingMachine, setDeletingMachine] = useState(false);

  // Manage Station Exercises Modal (View Multiple, Add, Edit, Delete)
  const [managedMachine, setManagedMachine] = useState<MachineItem | null>(null);

  // Add / Edit Exercise Guide Modal
  const [selectedMachineForGuide, setSelectedMachineForGuide] = useState<MachineItem | null>(null);
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);
  const [guideTitle, setGuideTitle] = useState('');
  const [targetMuscles, setTargetMuscles] = useState('');
  const [instructions, setInstructions] = useState('');
  const [formCues, setFormCues] = useState('');
  const [safety, setSafety] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [trainerName, setTrainerName] = useState('Coach Vikram');
  const [guideSubmitting, setGuideSubmitting] = useState(false);
  const [guideError, setGuideError] = useState<string | null>(null);
  const [deletingExerciseId, setDeletingExerciseId] = useState<string | null>(null);

  // QR preview & print state
  const [previewQrCode, setPreviewQrCode] = useState<string | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadMachines = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/machines');
      if (res.ok) {
        const data = await res.json();
        const loaded: MachineItem[] = data.data || [];
        setMachines(loaded);
        if (managedMachine) {
          const updatedManaged = loaded.find((m) => m.code === managedMachine.code) || null;
          setManagedMachine(updatedManaged);
        }
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

  const openAddMachineModal = () => {
    setEditingMachineCode(null);
    setCode('');
    setName('');
    setCategory('Conditioning / HYROX');
    setLocation('');
    setDescription('');
    setMachineError(null);
    setShowAddMachine(true);
  };

  const openEditMachineModal = (m: MachineItem) => {
    setEditingMachineCode(m.code);
    setCode(m.code);
    setName(m.name);
    setCategory(m.category);
    setLocation(m.location || '');
    setDescription(m.description || '');
    setMachineError(null);
    setShowAddMachine(true);
  };

  const handleSaveMachine = async (e: React.FormEvent) => {
    e.preventDefault();
    setMachineSubmitting(true);
    setMachineError(null);

    try {
      const csrfToken = getCookie(CSRF_COOKIE_NAME) || '';
      const isEdit = Boolean(editingMachineCode);
      const url = isEdit ? `/api/machines/${editingMachineCode}` : '/api/machines';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
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
        throw new Error(data.error || 'Failed to save machine.');
      }

      setShowAddMachine(false);
      setEditingMachineCode(null);
      await loadMachines();
    } catch (err: unknown) {
      setMachineError(err instanceof Error ? err.message : 'Error saving machine.');
    } finally {
      setMachineSubmitting(false);
    }
  };

  const handleDeleteMachine = async () => {
    if (!machineToDelete) return;
    setDeletingMachine(true);

    try {
      const csrfToken = getCookie(CSRF_COOKIE_NAME) || '';
      const res = await fetch(`/api/machines/${machineToDelete.code}`, {
        method: 'DELETE',
        headers: {
          [CSRF_HEADER_NAME]: csrfToken,
        },
      });

      if (res.ok) {
        if (managedMachine?.code === machineToDelete.code) {
          setManagedMachine(null);
        }
        setMachineToDelete(null);
        await loadMachines();
      }
    } catch (err) {
      console.error('Failed to delete machine:', err);
    } finally {
      setDeletingMachine(false);
    }
  };

  const openAddExerciseModal = (m: MachineItem) => {
    setSelectedMachineForGuide(m);
    setEditingExerciseId(null);
    setGuideTitle('');
    setTargetMuscles('');
    setInstructions('');
    setFormCues('');
    setSafety('');
    setVideoUrl('');
    setTrainerName('Coach Vikram');
    setGuideError(null);
  };

  const openEditExerciseModal = (m: MachineItem, ex: ExerciseItem) => {
    let parsedCues = '';
    try {
      const arr = JSON.parse(ex.formCues);
      parsedCues = Array.isArray(arr) ? arr.join('\n') : ex.formCues;
    } catch {
      parsedCues = ex.formCues;
    }

    setSelectedMachineForGuide(m);
    setEditingExerciseId(ex.id);
    setGuideTitle(ex.title);
    setTargetMuscles(ex.targetMuscleGroup);
    setInstructions(ex.instructions);
    setFormCues(parsedCues);
    setSafety(ex.safetyPrecautions || '');
    setVideoUrl(ex.videoUrl || '');
    setTrainerName(ex.trainerName || 'Coach Vikram');
    setGuideError(null);
  };

  const handleSaveGuide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMachineForGuide) return;

    setGuideSubmitting(true);
    setGuideError(null);

    try {
      const csrfToken = getCookie(CSRF_COOKIE_NAME) || '';
      const cuesList = formCues.split('\n').map((c) => c.trim()).filter(Boolean);
      const isEdit = Boolean(editingExerciseId);

      const res = await fetch(`/api/machines/${selectedMachineForGuide.code}`, {
        method: isEdit ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          [CSRF_HEADER_NAME]: csrfToken,
        },
        body: JSON.stringify({
          exerciseId: editingExerciseId || undefined,
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
        throw new Error(data.error || 'Failed to save exercise guide.');
      }

      setSelectedMachineForGuide(null);
      setEditingExerciseId(null);
      await loadMachines();
    } catch (err: unknown) {
      setGuideError(err instanceof Error ? err.message : 'Error saving exercise.');
    } finally {
      setGuideSubmitting(false);
    }
  };

  const handleDeleteExercise = async (machineCode: string, exerciseId: string) => {
    setDeletingExerciseId(exerciseId);
    try {
      const csrfToken = getCookie(CSRF_COOKIE_NAME) || '';
      const res = await fetch(`/api/machines/${machineCode}?exerciseId=${exerciseId}`, {
        method: 'DELETE',
        headers: {
          [CSRF_HEADER_NAME]: csrfToken,
        },
      });
      if (res.ok) {
        await loadMachines();
      }
    } catch (err) {
      console.error('Failed to delete exercise:', err);
    } finally {
      setDeletingExerciseId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#F8F9FA]">
            Equipment Stations & Multi-Exercise Guides
          </h1>
          <p className="text-xs text-[#94A3B8] mt-0.5">
            Register gym machines, attach multiple movement tutorials & videos per station, or delete unused stations.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => setShowPrintModal(true)}
            className="px-4 py-2.5 bg-[#1D222E] hover:bg-[#2A303C] border border-[#2A303C] hover:border-[#CADA03]/50 text-[#F8F9FA] hover:text-[#CADA03] font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition uppercase"
            title="Generate printable sticker sheets for equipment"
          >
            <Printer className="w-4 h-4 text-[#CADA03]" />
            <span>Print QR Labels</span>
          </button>

          <button
            onClick={openAddMachineModal}
            className="px-4 py-2.5 bg-[#CADA03] hover:bg-[#B8C702] text-[#0A0B0E] font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(202,218,3,0.3)] transition uppercase"
          >
            <Plus className="w-4 h-4 text-[#0A0B0E]" />
            <span>Add Machine Station</span>
          </button>
        </div>
      </div>

      {/* Machines List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-2 py-12 text-center text-[#94A3B8]">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#CADA03]" />
            <span>Loading equipment stations...</span>
          </div>
        ) : machines.length === 0 ? (
          <div className="col-span-2 py-12 text-center text-[#94A3B8] bg-[#14171F] rounded-2xl border border-[#2A303C]">
            No equipment registered yet. Click &quot;Add Machine Station&quot; above to add your first station.
          </div>
        ) : (
          machines.map((m) => {
            const exerciseList = m.exercises || [];
            const exerciseCount = exerciseList.length || m._count?.exercises || 0;

            return (
              <div
                key={m.id}
                className="p-5 bg-[#14171F] border border-[#2A303C] hover:border-[#2A303C]/90 rounded-2xl flex flex-col justify-between shadow-xl transition"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded bg-[#CADA03]/15 border border-[#CADA03]/40 text-[10px] font-bold text-[#CADA03] font-mono">
                        {m.code}
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                        {m.category}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setPreviewQrCode(m.code);
                          setCopied(false);
                        }}
                        className="p-1.5 rounded-lg bg-[#1D222E] hover:bg-[#2A303C] text-[#94A3B8] hover:text-[#CADA03] transition"
                        title="Station QR Code URL"
                      >
                        <QrCode className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => openEditMachineModal(m)}
                        className="p-1.5 rounded-lg bg-[#1D222E] hover:bg-[#2A303C] text-[#94A3B8] hover:text-[#F8F9FA] transition"
                        title="Edit Station Info"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => setMachineToDelete(m)}
                        className="p-1.5 rounded-lg bg-[#1D222E] hover:bg-red-950/60 text-[#94A3B8] hover:text-red-400 transition"
                        title="Delete Machine Station"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
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

                  {/* Quick Summary of Attached Exercises at this Station */}
                  <div className="mt-4 pt-3 border-t border-[#2A303C]/60">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] flex items-center gap-1">
                        <Layers className="w-3 h-3 text-[#CADA03]" />
                        <span>Station Exercises ({exerciseCount})</span>
                      </span>
                    </div>

                    {exerciseList.length === 0 ? (
                      <div className="text-[11px] text-[#94A3B8]/60 italic py-1">
                        No exercises added yet. Click &quot;+ Add Exercise&quot; below.
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {exerciseList.map((ex, idx) => (
                          <div
                            key={ex.id}
                            className="px-2.5 py-1.5 rounded-lg bg-[#0A0B0E] border border-[#2A303C] flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-[10px] font-mono font-bold text-[#CADA03] shrink-0">
                                #{idx + 1}
                              </span>
                              <span className="text-[#F8F9FA] font-semibold truncate">
                                {ex.title}
                              </span>
                              {ex.videoUrl && (
                                <span className="px-1.5 py-0.2 bg-[#CADA03]/15 text-[#CADA03] border border-[#CADA03]/30 rounded text-[9px] font-bold uppercase shrink-0 flex items-center gap-0.5">
                                  <Video className="w-2.5 h-2.5" /> Video
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => openEditExerciseModal(m, ex)}
                                className="p-1 text-[#94A3B8] hover:text-[#CADA03] transition"
                                title="Edit Exercise & Video"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteExercise(m.code, ex.id)}
                                disabled={deletingExerciseId === ex.id}
                                className="p-1 text-[#94A3B8] hover:text-red-400 transition disabled:opacity-50"
                                title="Remove Exercise"
                              >
                                {deletingExerciseId === ex.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[#2A303C] flex items-center justify-between gap-2">
                  <button
                    onClick={() => setManagedMachine(m)}
                    className="px-3 py-1.5 bg-[#1D222E] hover:bg-[#2A303C] text-xs font-bold text-[#F8F9FA] hover:text-[#CADA03] rounded-lg transition flex items-center gap-1.5 border border-[#2A303C]"
                  >
                    <Video className="w-3.5 h-3.5 text-[#CADA03]" />
                    <span>Manage & Preview ({exerciseCount})</span>
                  </button>

                  <button
                    onClick={() => openAddExerciseModal(m)}
                    className="px-3 py-1.5 bg-[#CADA03] hover:bg-[#B8C702] text-xs font-black text-[#0A0B0E] rounded-lg transition flex items-center gap-1 uppercase"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#0A0B0E]" />
                    <span>Add Exercise</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Manage & Preview Station Exercises Modal (In-Admin Preview without leaving Admin Portal) */}
      {managedMachine && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#14171F] border border-[#2A303C] rounded-2xl p-6 shadow-2xl relative max-h-[90vh] flex flex-col">
            <button
              onClick={() => setManagedMachine(null)}
              className="absolute top-4 right-4 text-[#94A3B8] hover:text-[#F8F9FA]"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center justify-between pr-8 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-[#CADA03]/15 border border-[#CADA03]/40 text-[10px] font-bold text-[#CADA03] font-mono">
                    {managedMachine.code}
                  </span>
                  <span className="text-xs text-[#94A3B8] font-semibold uppercase">
                    {managedMachine.category}
                  </span>
                </div>
                <h2 className="text-lg font-black text-[#F8F9FA] mt-1">
                  {managedMachine.name} — Exercises & Video Tutorials
                </h2>
              </div>

              <button
                onClick={() => openAddExerciseModal(managedMachine)}
                className="px-3 py-2 bg-[#CADA03] hover:bg-[#B8C702] text-[#0A0B0E] font-black rounded-xl text-xs flex items-center gap-1.5 uppercase shrink-0"
              >
                <Plus className="w-4 h-4 text-[#0A0B0E]" />
                <span>Add Exercise</span>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-4 pr-1">
              {(!managedMachine.exercises || managedMachine.exercises.length === 0) ? (
                <div className="p-8 text-center bg-[#0A0B0E] border border-[#2A303C] rounded-xl text-xs text-[#94A3B8]">
                  No exercises attached to this station yet. Click &quot;+ Add Exercise&quot; above to add movement tutorials and videos.
                </div>
              ) : (
                managedMachine.exercises.map((ex, idx) => {
                  let cues: string[] = [];
                  try {
                    cues = JSON.parse(ex.formCues);
                  } catch {
                    cues = ex.formCues ? [ex.formCues] : [];
                  }
                  const embedUrl = normalizeVideoEmbedUrl(ex.videoUrl);

                  return (
                    <div
                      key={ex.id}
                      className="p-4 bg-[#0A0B0E] border border-[#2A303C] rounded-xl space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#CADA03]">
                            Exercise #{idx + 1} • {ex.targetMuscleGroup}
                          </span>
                          <h3 className="text-base font-bold text-[#F8F9FA]">
                            {ex.title}
                          </h3>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => openEditExerciseModal(managedMachine, ex)}
                            className="px-2.5 py-1 bg-[#1D222E] hover:bg-[#2A303C] text-[#F8F9FA] hover:text-[#CADA03] rounded-lg text-xs font-bold flex items-center gap-1 transition"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit / Video</span>
                          </button>

                          <button
                            onClick={() => handleDeleteExercise(managedMachine.code, ex.id)}
                            disabled={deletingExerciseId === ex.id}
                            className="px-2.5 py-1 bg-[#1D222E] hover:bg-red-950/60 text-red-400 rounded-lg text-xs font-bold flex items-center gap-1 transition disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-[#94A3B8] leading-relaxed whitespace-pre-line bg-[#14171F] p-3 rounded-lg border border-[#2A303C]">
                        {ex.instructions}
                      </p>

                      {cues.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {cues.map((cue, cIdx) => (
                            <span
                              key={cIdx}
                              className="inline-flex items-center gap-1 text-[11px] text-[#F8F9FA] bg-[#1D222E] px-2.5 py-1 rounded-md border border-[#2A303C]"
                            >
                              <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                              <span>{cue}</span>
                            </span>
                          ))}
                        </div>
                      )}

                      {ex.safetyPrecautions && (
                        <div className="p-2.5 bg-red-950/30 border border-red-500/30 rounded-lg text-xs text-red-200 flex items-start gap-2">
                          <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                          <span>{ex.safetyPrecautions}</span>
                        </div>
                      )}

                      {embedUrl && (
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#CADA03] flex items-center gap-1">
                            <Video className="w-3.5 h-3.5" /> Embedded Tutorial Video
                          </span>
                          <div className="aspect-video w-full rounded-xl overflow-hidden bg-black border border-[#2A303C]">
                            <iframe
                              src={embedUrl}
                              title={ex.title}
                              className="w-full h-full border-0"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-[#2A303C] flex justify-end">
              <button
                onClick={() => setManagedMachine(null)}
                className="px-4 py-2 bg-[#1D222E] hover:bg-[#2A303C] text-xs font-bold text-[#F8F9FA] rounded-xl"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Machine Confirmation Modal */}
      {machineToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#14171F] border border-red-500/40 rounded-2xl p-6 shadow-2xl relative">
            <h2 className="text-lg font-bold text-[#F8F9FA] mb-1">
              Delete Machine Station?
            </h2>
            <p className="text-xs text-[#94A3B8] leading-relaxed mb-4">
              Are you sure you want to permanently remove <strong className="text-[#F8F9FA]">{machineToDelete.name} ({machineToDelete.code})</strong> and all of its attached exercise guides?
            </p>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMachineToDelete(null)}
                className="px-4 py-2 bg-[#1D222E] hover:bg-[#2A303C] text-xs font-bold text-[#F8F9FA] rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteMachine}
                disabled={deletingMachine}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-xs font-black text-white rounded-xl flex items-center gap-1.5 disabled:opacity-50 uppercase"
              >
                {deletingMachine ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Delete Permanently</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Machine Modal */}
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
              {editingMachineCode ? `Edit Station ${editingMachineCode}` : 'Register Equipment Station'}
            </h2>

            {machineError && (
              <div className="mb-4 p-3 bg-red-950/40 border border-red-500/40 rounded-xl text-red-200 text-xs">
                {machineError}
              </div>
            )}

            <form onSubmit={handleSaveMachine} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                    Machine Code *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(editingMachineCode)}
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="e.g. M-SKI-01"
                    className="w-full px-3 py-2 bg-[#0A0B0E] border border-[#2A303C] focus:border-[#CADA03] rounded-xl text-xs text-[#F8F9FA] outline-none font-mono disabled:opacity-50"
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
                  <span>{editingMachineCode ? 'Update Station' : 'Save Machine'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Exercise Guide Modal */}
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
              {editingExerciseId ? 'Edit Exercise & Video Tutorial' : `Add Exercise Guide to ${selectedMachineForGuide.name}`}
            </h2>
            <p className="text-xs text-[#94A3B8] mb-4 font-mono">
              Station Code: {selectedMachineForGuide.code} • You can attach multiple exercises to this station
            </p>

            {guideError && (
              <div className="mb-4 p-3 bg-red-950/40 border border-red-500/40 rounded-xl text-red-200 text-xs">
                {guideError}
              </div>
            )}

            <form onSubmit={handleSaveGuide} className="space-y-3.5">
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
                    Demo Video URL (YouTube / Vimeo)
                  </label>
                  <input
                    type="url"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="https://youtu.be/... or https://youtube.com/watch?v=..."
                    className="w-full px-3 py-2 bg-[#0A0B0E] border border-[#2A303C] focus:border-[#CADA03] rounded-xl text-xs text-[#F8F9FA] outline-none"
                  />
                  <p className="text-[10px] text-[#94A3B8]/70 mt-1">
                    Standard YouTube, Shorts, or Vimeo URLs are auto-converted to embed format.
                  </p>
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
                  <span>{editingExerciseId ? 'Update Exercise Guide' : 'Save Exercise Guide'}</span>
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

      {/* Equipment Print Modal Sheet */}
      <EquipmentPrintModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        machines={machines}
      />
    </div>
  );
}
