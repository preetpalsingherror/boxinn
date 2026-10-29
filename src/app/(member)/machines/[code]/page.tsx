'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { 
  Dumbbell, 
  ArrowLeft, 
  MapPin, 
  ShieldAlert, 
  CheckCircle2, 
  Video, 
  User, 
  Sparkles,
  ExternalLink
} from 'lucide-react';

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

interface Exercise {
  id: string;
  title: string;
  targetMuscleGroup: string;
  instructions: string;
  formCues: string;
  safetyPrecautions: string;
  videoUrl: string | null;
  trainerName: string;
  difficulty: string;
}

interface MachineDetail {
  id: string;
  code: string;
  name: string;
  category: string;
  location: string;
  description: string;
  exercises: Exercise[];
}

export default function MachineDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const [machine, setMachine] = useState<MachineDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadMachine() {
      try {
        const res = await fetch(`/api/machines/${code}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Machine not found.');
        }
        setMachine(data.data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load machine.');
      } finally {
        setLoading(false);
      }
    }
    loadMachine();
  }, [code]);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse max-w-xl mx-auto">
        <div className="h-6 w-24 bg-[#14171F] rounded-lg"></div>
        <div className="h-32 bg-[#14171F] rounded-2xl"></div>
        <div className="h-64 bg-[#14171F] rounded-2xl"></div>
      </div>
    );
  }

  if (error || !machine) {
    return (
      <div className="text-center py-16 space-y-4 max-w-md mx-auto">
        <ShieldAlert className="w-12 h-12 text-red-400 mx-auto" />
        <h1 className="text-xl font-bold text-[#F8F9FA]">Equipment Guide Not Found</h1>
        <p className="text-xs text-[#94A3B8]">
          No active machine registered with code &quot;{code}&quot;.
        </p>
        <Link
          href="/machines"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#CADA03] hover:bg-[#B8C702] text-[#0A0B0E] font-black rounded-xl text-xs uppercase"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Equipment
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <Link
          href="/machines"
          className="p-2 -ml-2 text-[#94A3B8] hover:text-[#F8F9FA] rounded-lg transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#14171F] border border-[#CADA03]/40 text-[10px] font-mono font-bold text-[#CADA03]">
          <span>QR GUIDE</span> • <span>{machine.code}</span>
        </div>
        <div className="w-9"></div>
      </div>

      {/* Machine Overview Card */}
      <div className="relative overflow-hidden bg-[#14171F] border border-[#2A303C] rounded-2xl p-5 shadow-xl space-y-3">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#CADA03] via-[#CADA03]/60 to-transparent" />
        <img
          src="/brand/boxinn-stacked-dark.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none select-none absolute -right-4 -bottom-4 h-28 w-auto opacity-[0.06] object-contain"
        />
        <div className="relative flex items-start justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-[#CADA03]">
              <img src="/brand/bxn-badge.svg" alt="BXN" className="w-4 h-4 object-contain" />
              <span>{machine.category}</span>
            </div>
            <h1 className="text-xl font-black text-[#F8F9FA] mt-1">
              {machine.name}
            </h1>
          </div>
          <div className="p-2.5 rounded-xl bg-[#1D222E] text-[#CADA03] border border-[#CADA03]/30 shrink-0">
            <Dumbbell className="w-6 h-6" />
          </div>
        </div>

        <p className="text-xs text-[#94A3B8] leading-relaxed">
          {machine.description}
        </p>

        <div className="pt-3 border-t border-[#2A303C] flex items-center gap-2 text-xs text-[#94A3B8]">
          <MapPin className="w-4 h-4 text-[#CADA03]" />
          <span>Gym Floor Location: <strong className="text-[#F8F9FA]">{machine.location}</strong></span>
        </div>
      </div>

      {/* Exercise Guides Section */}
      <div className="space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#94A3B8] flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-[#CADA03]" />
          <span>Trainer-Curated Movement Tutorials ({machine.exercises.length})</span>
        </h2>

        {machine.exercises.length === 0 ? (
          <div className="p-8 text-center bg-[#14171F] rounded-2xl border border-[#2A303C] text-[#94A3B8] text-xs">
            No specific movement guides assigned to this station yet. Please ask on-floor coaches for form guidance.
          </div>
        ) : (
          machine.exercises.map((ex, idx) => {
            let cues: string[] = [];
            try {
              cues = JSON.parse(ex.formCues);
            } catch {
              cues = [ex.formCues];
            }

            return (
              <div
                key={ex.id}
                className="bg-[#14171F] border border-[#2A303C] rounded-2xl p-5 space-y-4 shadow-xl"
              >
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                      Exercise #{idx + 1} • {ex.targetMuscleGroup}
                    </span>
                    <h3 className="text-base font-bold text-[#F8F9FA] mt-0.5">
                      {ex.title}
                    </h3>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-[#1D222E] border border-[#2A303C] text-[10px] font-bold text-[#94A3B8] uppercase">
                    {ex.difficulty.replace('_', ' ')}
                  </span>
                </div>

                {/* Instructions */}
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                    Movement Execution
                  </h4>
                  <p className="text-xs text-[#F8F9FA] leading-relaxed whitespace-pre-line bg-[#0A0B0E] p-3 rounded-xl border border-[#2A303C]">
                    {ex.instructions}
                  </p>
                </div>

                {/* Form Cues */}
                {cues.length > 0 && (
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                      Key Form Cues
                    </h4>
                    <div className="space-y-1.5">
                      {cues.map((cue, cIdx) => (
                        <div
                          key={cIdx}
                          className="flex items-center gap-2 text-xs text-[#F8F9FA] bg-[#1D222E]/80 px-3 py-1.5 rounded-lg border border-[#2A303C]"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>{cue}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Safety Precautions */}
                <div className="p-3 bg-red-950/30 border border-red-500/30 rounded-xl text-xs text-red-200">
                  <div className="flex items-center gap-1.5 font-bold text-red-400 mb-0.5">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Safety Warning</span>
                  </div>
                  <p className="text-red-200/90 leading-relaxed">
                    {ex.safetyPrecautions}
                  </p>
                </div>

                {/* Video Demonstration Player */}
                {ex.videoUrl && (
                  <div className="space-y-1.5">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] flex items-center gap-1.5">
                      <Video className="w-3.5 h-3.5 text-[#CADA03]" />
                      <span>Form Demonstration Video</span>
                    </h4>
                    <div className="aspect-video w-full rounded-xl overflow-hidden bg-[#0A0B0E] border border-[#2A303C]">
                      <iframe
                        src={normalizeVideoEmbedUrl(ex.videoUrl) || ex.videoUrl}
                        title={`${ex.title} Form Demonstration`}
                        className="w-full h-full border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  </div>
                )}

                {/* Trainer & Video Link */}
                <div className="pt-2 border-t border-[#2A303C] flex items-center justify-between text-xs text-[#94A3B8]">
                  <span className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-[#CADA03]" />
                    <span>Approved by {ex.trainerName}</span>
                  </span>

                  {ex.videoUrl && (
                    <a
                      href={ex.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[#CADA03] font-bold hover:underline"
                    >
                      <Video className="w-3.5 h-3.5" />
                      <span>Direct Video Link</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
