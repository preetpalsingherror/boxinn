'use client';

import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Printer, X, Check, Copy, Download, QrCode, ShieldCheck } from 'lucide-react';

interface EntranceQrModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function EntranceQrModal({ isOpen, onClose }: EntranceQrModalProps) {
  const [svgContent, setSvgContent] = useState<string>('');
  const [checkInUrl, setCheckInUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const url = `${origin}/checkin?code=BOXINN-ENTRANCE-YELAHANKA&auto=1`;
    setCheckInUrl(url);

    QRCode.toString(url, {
      type: 'svg',
      margin: 1,
      width: 260,
      color: {
        dark: '#0A0B0E',
        light: '#FFFFFF',
      },
    })
      .then((svg) => setSvgContent(svg))
      .catch((err) => console.error('Failed to generate entrance QR:', err));
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(checkInUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSvg = () => {
    if (!svgContent) return;
    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'boxinn-entrance-checkin-qr.svg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrintPoster = () => {
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>BOX INN — Facility Entrance Check-In QR Poster</title>
          <style>
            @page { size: A4 portrait; margin: 15mm; }
            body {
              font-family: system-ui, -apple-system, sans-serif;
              background: #0A0B0E;
              color: #F8F9FA;
              margin: 0;
              padding: 40px 24px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              text-align: center;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .poster {
              border: 4px solid #CADA03;
              border-radius: 28px;
              padding: 40px 36px;
              max-width: 520px;
              background: #14171F;
            }
            .badge {
              display: inline-block;
              background: #CADA03;
              color: #0A0B0E;
              font-weight: 900;
              font-size: 12px;
              padding: 6px 16px;
              border-radius: 999px;
              letter-spacing: 2px;
              text-transform: uppercase;
              margin-bottom: 16px;
            }
            h1 {
              font-size: 32px;
              font-weight: 900;
              margin: 8px 0;
              letter-spacing: -0.5px;
              text-transform: uppercase;
            }
            p.sub {
              color: #94A3B8;
              font-size: 14px;
              margin-bottom: 28px;
            }
            .qr-box {
              background: #FFFFFF;
              padding: 20px;
              border-radius: 24px;
              display: inline-block;
              border: 4px solid #CADA03;
              margin-bottom: 24px;
            }
            .qr-box svg {
              width: 280px;
              height: 280px;
              display: block;
            }
            .code-pill {
              font-family: monospace;
              font-size: 13px;
              font-weight: 700;
              color: #CADA03;
              background: #0A0B0E;
              padding: 8px 16px;
              border-radius: 10px;
              border: 1px solid #2A303C;
              display: inline-block;
              margin-bottom: 20px;
            }
            .steps {
              text-align: left;
              background: #0A0B0E;
              padding: 16px 20px;
              border-radius: 16px;
              border: 1px solid #2A303C;
              font-size: 13px;
              line-height: 1.6;
              color: #F8F9FA;
            }
          </style>
        </head>
        <body>
          <div class="poster">
            <div class="badge">BOX INN • Yelahanka Facility</div>
            <h1>Athlete Entrance Check-In</h1>
            <p class="sub">Scan Upon Arrival to Log Attendance & Daily Streak</p>
            <div class="qr-box">${svgContent}</div>
            <div><span class="code-pill">STATION: BOXINN-ENTRANCE-YELAHANKA</span></div>
            <div class="steps">
              <strong>How to Check In:</strong><br/>
              1. Open your <strong>BOX INN Member Companion</strong> app and tap <strong>Check-In</strong>, OR scan directly with your phone camera.<br/>
              2. Your daily attendance and consistency streak will update immediately.<br/>
              3. Sessions automatically close 3 hours after entrance scan.
            </div>
          </div>
          <script>
            window.onload = () => { setTimeout(() => window.print(), 300); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#14171F] border border-[#CADA03]/40 rounded-2xl p-6 shadow-2xl relative text-center">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#94A3B8] hover:text-[#F8F9FA] transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#CADA03]/15 border border-[#CADA03]/40 text-[10px] font-black uppercase tracking-widest text-[#CADA03] mb-2">
          <QrCode className="w-3.5 h-3.5" />
          <span>Reception Desk QR</span>
        </div>

        <h2 className="text-xl font-black text-[#F8F9FA] uppercase tracking-tight">
          Facility Entrance Check-In QR
        </h2>
        <p className="text-xs text-[#94A3B8] mt-1 mb-4">
          Display or print this QR code at the gym entrance for members to scan when arriving.
        </p>

        {/* Scannable QR Box */}
        <div className="bg-white p-4 rounded-2xl border-4 border-[#CADA03] inline-block shadow-[0_0_24px_rgba(202,218,3,0.2)] mb-3">
          {svgContent ? (
            <div
              className="w-56 h-56 mx-auto [&>svg]:w-full [&>svg]:h-full"
              dangerouslySetInnerHTML={{ __html: svgContent }}
            />
          ) : (
            <div className="w-56 h-56 flex items-center justify-center text-[#0A0B0E] text-xs font-bold">
              Generating QR...
            </div>
          )}
        </div>

        <div className="text-[11px] font-mono font-bold text-[#CADA03] mb-4">
          CODE: BOXINN-ENTRANCE-YELAHANKA
        </div>

        <div className="p-3 bg-[#0A0B0E] border border-[#2A303C] rounded-xl text-left text-[11px] text-[#94A3B8] space-y-1 mb-4">
          <div className="font-bold text-[#F8F9FA] flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#CADA03]" />
            <span>Works with Both Scan Methods:</span>
          </div>
          <p>1. <strong>In-App Scanner</strong>: Member opens <code>/checkin</code> camera and points at this code.</p>
          <p>2. <strong>Phone Camera</strong>: Member scans with iOS/Android camera and is auto-checked in on open.</p>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={handlePrintPoster}
            className="py-2.5 px-3 bg-[#CADA03] hover:bg-[#B8C702] text-[#0A0B0E] font-black rounded-xl text-xs flex items-center justify-center gap-1.5 transition uppercase shadow-[0_4px_14px_rgba(202,218,3,0.25)]"
          >
            <Printer className="w-4 h-4 text-[#0A0B0E]" />
            <span>Print Poster</span>
          </button>

          <button
            onClick={handleDownloadSvg}
            className="py-2.5 px-3 bg-[#1D222E] hover:bg-[#2A303C] text-[#F8F9FA] hover:text-[#CADA03] font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 border border-[#2A303C] transition"
          >
            <Download className="w-4 h-4 text-[#CADA03]" />
            <span>Download SVG</span>
          </button>
        </div>

        <button
          onClick={handleCopy}
          className="mt-2.5 w-full py-2 px-3 bg-[#0A0B0E] hover:bg-[#1D222E] text-[#94A3B8] hover:text-[#F8F9FA] font-semibold rounded-xl text-[11px] flex items-center justify-center gap-1.5 border border-[#2A303C] transition"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied Check-In URL!' : 'Copy Direct Check-In URL'}</span>
        </button>
      </div>
    </div>
  );
}
