'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Dumbbell, ArrowRight, QrCode, Search, MapPin } from 'lucide-react';

interface MachineItem {
  id: string;
  code: string;
  name: string;
  category: string;
  location: string;
  description: string;
  _count: { exercises: number };
}

export default function MachinesPage() {
  const [machines, setMachines] = useState<MachineItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMachines() {
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
    }
    loadMachines();
  }, []);

  const filtered = machines.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.code.toLowerCase().includes(search.toLowerCase()) ||
      m.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-black tracking-wider uppercase text-[#F8F9FA]">
          Equipment & Guides
        </h1>
        <p className="text-xs text-[#94A3B8] mt-0.5">
          Scan QR codes on machines or browse trainer-approved exercise guides.
        </p>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by machine name, code (e.g. M-ROW-01), or muscle group"
          className="w-full pl-10 pr-4 py-3 bg-[#14171F] border border-[#2A303C] focus:border-[#CADA03] rounded-xl text-[#F8F9FA] placeholder-[#94A3B8]/50 outline-none text-xs"
        />
      </div>

      {/* Machine Cards */}
      {loading ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-28 bg-[#14171F] rounded-2xl"></div>
          <div className="h-28 bg-[#14171F] rounded-2xl"></div>
          <div className="h-28 bg-[#14171F] rounded-2xl"></div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-[#94A3B8] space-y-2">
          <Dumbbell className="w-10 h-10 mx-auto text-[#2A303C]" />
          <p className="text-sm font-semibold text-[#F8F9FA]">No equipment matches your search.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((m) => (
            <Link
              key={m.id}
              href={`/machines/${m.code}`}
              className="block p-4 bg-[#14171F] hover:bg-[#1D222E] border border-[#2A303C] hover:border-[#CADA03]/50 rounded-2xl transition shadow-lg group"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-[#CADA03]/15 border border-[#CADA03]/40 text-[10px] font-bold text-[#CADA03] font-mono">
                      {m.code}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                      {m.category}
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-[#F8F9FA] mt-1.5 group-hover:text-[#CADA03] transition">
                    {m.name}
                  </h2>
                </div>
                <div className="p-2 rounded-xl bg-[#0A0B0E] border border-[#2A303C] text-[#94A3B8] group-hover:text-[#CADA03] transition">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>

              <p className="text-xs text-[#94A3B8] mt-2 line-clamp-2 leading-relaxed">
                {m.description}
              </p>

              <div className="mt-3 pt-3 border-t border-[#2A303C] flex items-center justify-between text-[11px] text-[#94A3B8]">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-[#CADA03]" />
                  <span>{m.location}</span>
                </span>
                <span className="font-semibold text-[#F8F9FA]">
                  {m._count.exercises} {m._count.exercises === 1 ? 'guide' : 'guides'} available
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
