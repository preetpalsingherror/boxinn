'use client';

import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Printer, X, Check, Copy, Sparkles, AlertCircle } from 'lucide-react';

interface MachineItem {
  id: string;
  code: string;
  name: string;
  category: string;
  location: string;
  _count: {
    exercises: number;
  };
}

interface EquipmentPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  machines: MachineItem[];
}

interface SvgMap {
  [code: string]: string;
}

export function EquipmentPrintModal({ isOpen, onClose, machines }: EquipmentPrintModalProps) {
  const [svgMap, setSvgMap] = useState<SvgMap>({});
  const [loading, setLoading] = useState(true);
  const [baseUrl, setBaseUrl] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBaseUrl(window.location.origin);
    }
  }, []);

  useEffect(() => {
    if (!isOpen || machines.length === 0) return;

    let isMounted = true;
    setLoading(true);

    async function generateAllQrs() {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const map: SvgMap = {};

      for (const m of machines) {
        const targetUrl = `${origin}/machines/${m.code}`;
        try {
          // Generate sharp vector SVG
          const svgString = await QRCode.toString(targetUrl, {
            type: 'svg',
            margin: 1,
            color: {
              dark: '#0A0B0E',
              light: '#FFFFFF',
            },
            errorCorrectionLevel: 'M',
          });
          map[m.code] = svgString;
        } catch (err) {
          console.error(`Failed to generate QR for ${m.code}`, err);
        }
      }

      if (isMounted) {
        setSvgMap(map);
        setLoading(false);
      }
    }

    generateAllQrs();

    return () => {
      isMounted = false;
    };
  }, [isOpen, machines]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md p-4 sm:p-6 print:p-0 print:bg-white print:static print:overflow-visible">
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-sticker-container, #print-sticker-container * {
            visibility: visible;
          }
          #print-sticker-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
          .page-break {
            page-break-after: always;
          }
        }
      `}</style>

      <div className="max-w-5xl mx-auto space-y-4">
        {/* Modal Controls (Hidden in Print) */}
        <div className="no-print bg-[#14171F] border border-[#2A303C] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xl">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-[#CADA03] text-[#0A0B0E] text-[10px] font-black uppercase tracking-wider">
                Print Center
              </span>
              <h2 className="text-lg font-black text-[#F8F9FA]">
                Equipment QR Sticker Labels ({machines.length} Stations)
              </h2>
            </div>
            <p className="text-xs text-[#94A3B8] mt-1">
              Formatted for standard A4 / US Letter adhesive sticker sheets. Cut along the dashed outlines.
            </p>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              onClick={onClose}
              className="px-4 py-2.5 bg-[#1D222E] hover:bg-[#2A303C] text-xs font-bold text-[#94A3B8] hover:text-[#F8F9FA] rounded-xl transition"
            >
              Close
            </button>
            <button
              onClick={handlePrint}
              disabled={loading}
              className="px-5 py-2.5 bg-[#CADA03] hover:bg-[#B8C702] text-[#0A0B0E] text-xs font-black rounded-xl flex items-center gap-2 shadow-[0_4px_16px_rgba(202,218,3,0.3)] transition uppercase disabled:opacity-50"
            >
              <Printer className="w-4 h-4 text-[#0A0B0E]" />
              <span>Print All Labels Now</span>
            </button>
          </div>
        </div>

        {/* Printable Sticker Sheet */}
        <div
          id="print-sticker-container"
          className="bg-[#0A0B0E] print:bg-white rounded-3xl p-6 print:p-0 border border-[#2A303C] print:border-none shadow-2xl"
        >
          {loading ? (
            <div className="py-20 text-center text-[#94A3B8] no-print">
              <div className="w-8 h-8 border-2 border-[#CADA03] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <span>Generating scannable vector SVG QR codes...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-6 print:gap-4">
              {machines.map((m) => (
                <div
                  key={m.id}
                  className="bg-[#14171F] print:bg-white border-2 border-dashed border-[#2A303C] print:border-neutral-400 rounded-3xl p-5 print:p-4 flex flex-col justify-between shadow-xl print:shadow-none break-inside-avoid relative overflow-hidden"
                >
                  {/* Gym Brand Header */}
                  <div className="flex items-center justify-between border-b border-[#2A303C] print:border-neutral-200 pb-3 mb-3">
                    <div className="flex items-center gap-2.5">
                      <img
                        src="/brand/boxinn-horizontal-dark.png"
                        alt="BOX INN"
                        className="h-8 w-auto object-contain print:hidden drop-shadow-[0_2px_8px_rgba(202,218,3,0.25)]"
                      />
                      <img
                        src="/brand/boxinn-horizontal.png"
                        alt="BOX INN"
                        className="hidden print:block h-8 w-auto object-contain"
                      />
                    </div>

                    <div className="text-right">
                      <span className="px-2.5 py-1 rounded-lg bg-[#CADA03] print:bg-black text-[#0A0B0E] print:text-white font-mono text-xs font-black tracking-wider">
                        {m.code}
                      </span>
                    </div>
                  </div>

                  {/* Machine Information */}
                  <div className="text-center my-1">
                    <h3 className="text-base font-black text-[#F8F9FA] print:text-black leading-tight">
                      {m.name}
                    </h3>
                    <div className="inline-flex items-center gap-1.5 mt-1 text-[11px] font-bold text-[#CADA03] print:text-neutral-700">
                      <span>{m.category}</span>
                      <span>•</span>
                      <span>Floor: {m.location}</span>
                    </div>
                  </div>

                  {/* High Contrast Scannable QR Code */}
                  <div className="my-3 flex flex-col items-center">
                    <div className="p-3 bg-white rounded-2xl border-2 border-neutral-300 shadow-inner inline-block">
                      {svgMap[m.code] ? (
                        <div
                          className="w-40 h-40 print:w-36 print:h-36"
                          dangerouslySetInnerHTML={{ __html: svgMap[m.code] }}
                        />
                      ) : (
                        <div className="w-40 h-40 flex items-center justify-center text-neutral-400 text-xs">
                          Loading QR...
                        </div>
                      )}
                    </div>
                    <div className="mt-2 text-[10px] font-mono text-[#94A3B8] print:text-neutral-600">
                      {baseUrl ? `${baseUrl}/machines/${m.code}` : `/machines/${m.code}`}
                    </div>
                  </div>

                  {/* Scan Instructions Callout */}
                  <div className="mt-2 p-2.5 bg-[#1D222E] print:bg-neutral-100 rounded-xl text-center border border-[#2A303C] print:border-neutral-300">
                    <p className="text-[11px] font-black text-[#F8F9FA] print:text-black tracking-wide uppercase">
                      Scan with Phone Camera
                    </p>
                    <p className="text-[10px] text-[#94A3B8] print:text-neutral-600 mt-0.5 leading-snug">
                      Instant form cues, video demos &amp; safety guidance ({m._count.exercises} tutorials)
                    </p>
                  </div>

                  {/* Cut Indicator */}
                  <div className="no-print mt-3 text-center text-[9px] text-[#94A3B8]/60 uppercase tracking-widest font-mono">
                    ✂ Cut along dashed border to stick on equipment
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
