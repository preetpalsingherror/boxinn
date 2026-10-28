'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { 
  QrCode, 
  CheckCircle2, 
  Clock, 
  Flame, 
  ShieldAlert, 
  Loader2, 
  ArrowLeft,
  Calendar,
  Camera,
  CameraOff,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '../../../presentation/security/cookie-constants.ts';

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
  return match ? decodeURIComponent(match[3]) : null;
}

export default function CheckInPage() {
  const [mode, setMode] = useState<'camera' | 'button'>('camera');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    isDuplicate: boolean;
    message: string;
    gymDate: string;
    checkInTime: string;
    streak?: { currentStreak: number; longestStreak: number };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState('');
  const scannerRef = useRef<any>(null);

  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Clean up camera on unmount & auto-trigger if opened via Entrance QR URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const codeParam = params.get('code');
      const autoParam = params.get('auto');
      if (codeParam || autoParam === '1') {
        handleCheckIn(codeParam || 'BOXINN-ENTRANCE-YELAHANKA');
      }
    }
    return () => {
      stopCamera();
    };
  }, []);

  const stopCamera = async () => {
    try {
      if (scannerRef.current) {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
        scannerRef.current = null;
      }
    } catch (e) {
      console.warn('Error stopping camera scanner:', e);
    }
    setCameraActive(false);
  };

  const startCamera = async () => {
    setCameraError(null);
    setError(null);

    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      
      // Stop any existing instance
      await stopCamera();

      const html5QrCode = new Html5Qrcode('qr-reader');
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 240, height: 240 },
          aspectRatio: 1.0,
        },
        async (decodedText: string) => {
          // Detected QR code!
          if (navigator.vibrate) {
            navigator.vibrate(100);
          }
          await stopCamera();
          await handleCheckIn(decodedText);
        },
        () => {
          // Frame scan error (no QR in view), ignored
        }
      );

      setCameraActive(true);
    } catch (err: unknown) {
      console.error('Camera startup error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('NotAllowedError') || msg.includes('Permission')) {
        setCameraError('Camera permission was denied. Please allow camera access in browser settings or use Quick Check-In.');
      } else if (msg.includes('NotFoundError') || msg.includes('DevicesNotFoundError')) {
        setCameraError('No camera found on this device. Please use Quick Check-In.');
      } else {
        setCameraError('Could not initialize camera scanner. You can use Quick Check-In below.');
      }
      setCameraActive(false);
    }
  };

  const handleCheckIn = async (scannedPayload?: string) => {
    setLoading(true);
    setError(null);

    try {
      const csrfToken = getCookie(CSRF_COOKIE_NAME) || '';

      const res = await fetch('/api/attendance/check-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [CSRF_HEADER_NAME]: csrfToken,
        },
        body: JSON.stringify({
          source: scannedPayload ? 'ENTRANCE_QR' : 'ENTRANCE_QR',
          qrPayload: scannedPayload || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Check-in failed.');
      }

      setResult(data.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Check-in error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/home"
          className="p-2 -ml-2 text-[#94A3B8] hover:text-[#F8F9FA] rounded-lg transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="text-center">
          <h1 className="text-lg font-black tracking-wider uppercase text-[#F8F9FA]">
            Facility Check-In
          </h1>
          <p className="text-[11px] text-[#94A3B8]">Asia/Kolkata • {currentTime || 'Loading...'}</p>
        </div>
        <div className="w-9"></div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-red-950/40 border border-red-500/40 rounded-2xl flex items-start gap-3 text-red-200 text-sm shadow-xl">
          <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">{error}</div>
        </div>
      )}

      {/* Result Display */}
      {result ? (
        <div className="bg-[#14171F] border border-[#2A303C] rounded-2xl p-6 shadow-2xl text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-950/60 border border-emerald-500/40 mx-auto flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-[#F8F9FA]">
              {result.isDuplicate ? 'Visit Already Logged Today' : 'Check-In Confirmed!'}
            </h2>
            <p className="text-xs text-[#94A3B8] mt-1.5 leading-relaxed max-w-xs mx-auto">
              {result.message}
            </p>
          </div>

          {result.streak && (
            <div className="p-4 bg-[#1D222E] rounded-xl border border-[#2A303C] flex items-center justify-around text-center">
              <div>
                <div className="text-xs text-[#94A3B8] uppercase tracking-wider font-semibold">
                  Current Streak
                </div>
                <div className="text-2xl font-black text-[#CADA03] flex items-center justify-center gap-1 mt-0.5">
                  <Flame className="w-5 h-5 text-[#CADA03]" />
                  <span>{result.streak.currentStreak} Days</span>
                </div>
              </div>
              <div className="h-8 w-px bg-[#2A303C]"></div>
              <div>
                <div className="text-xs text-[#94A3B8] uppercase tracking-wider font-semibold">
                  Longest Record
                </div>
                <div className="text-2xl font-black text-[#F8F9FA] mt-0.5">
                  {result.streak.longestStreak} Days
                </div>
              </div>
            </div>
          )}

          <div className="text-xs text-[#94A3B8] flex items-center justify-center gap-1.5 pt-2">
            <Clock className="w-4 h-4 text-[#CADA03]" />
            <span>Attendance sessions automatically close after 3 hours.</span>
          </div>

          <div className="pt-2">
            <Link
              href="/home"
              className="w-full py-3 px-4 bg-[#CADA03] hover:bg-[#B8C702] text-[#0A0B0E] font-black rounded-xl flex items-center justify-center gap-2 transition text-sm uppercase"
            >
              <span>Back to Home</span>
            </Link>
          </div>
        </div>
      ) : (
        /* Action Console with In-App QR Scanner */
        <div className="bg-[#14171F] border border-[#2A303C] rounded-2xl p-5 sm:p-7 shadow-2xl space-y-5">
          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-[#0A0B0E] border border-[#2A303C] rounded-xl">
            <button
              onClick={() => {
                setMode('camera');
                if (!cameraActive) startCamera();
              }}
              className={`py-2 px-3 rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition ${
                mode === 'camera'
                  ? 'bg-[#CADA03] text-[#0A0B0E] shadow-[0_2px_8px_rgba(202,218,3,0.3)]'
                  : 'text-[#94A3B8] hover:text-[#F8F9FA]'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Camera Scan</span>
            </button>

            <button
              onClick={() => {
                setMode('button');
                stopCamera();
              }}
              className={`py-2 px-3 rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition ${
                mode === 'button'
                  ? 'bg-[#CADA03] text-[#0A0B0E] shadow-[0_2px_8px_rgba(202,218,3,0.3)]'
                  : 'text-[#94A3B8] hover:text-[#F8F9FA]'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Quick Check-In</span>
            </button>
          </div>

          {/* Camera Scanner View */}
          {mode === 'camera' && (
            <div className="space-y-4 text-center">
              {/* QR Reader Viewport */}
              <div className="relative mx-auto w-full aspect-square max-w-[280px] bg-[#0A0B0E] border-2 border-dashed border-[#CADA03]/60 rounded-3xl overflow-hidden flex flex-col items-center justify-center shadow-inner">
                {/* HTML5 QR Container */}
                <div id="qr-reader" className="w-full h-full overflow-hidden [&_video]:w-full [&_video]:h-full [&_video]:object-cover" />

                {/* Viewfinder Overlay when active */}
                {cameraActive && (
                  <div className="absolute inset-4 pointer-events-none flex flex-col items-center justify-between">
                    <div className="w-full flex justify-between">
                      <div className="w-5 h-5 border-t-2 border-l-2 border-[#CADA03]" />
                      <div className="w-5 h-5 border-t-2 border-r-2 border-[#CADA03]" />
                    </div>
                    {/* Animated scanning line */}
                    <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-[#CADA03] to-transparent shadow-[0_0_8px_#CADA03] animate-pulse" />
                    <div className="w-full flex justify-between">
                      <div className="w-5 h-5 border-b-2 border-l-2 border-[#CADA03]" />
                      <div className="w-5 h-5 border-b-2 border-r-2 border-[#CADA03]" />
                    </div>
                  </div>
                )}

                {/* Idle / Permission prompt overlay */}
                {!cameraActive && (
                  <div className="absolute inset-0 bg-[#0A0B0E]/95 p-5 flex flex-col items-center justify-center text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-[#1D222E] border border-[#CADA03]/30 flex items-center justify-center text-[#CADA03]">
                      <Camera className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#F8F9FA]">In-App QR Reader</div>
                      <div className="text-[11px] text-[#94A3B8] mt-0.5">
                        Point your camera at the BOX INN entrance sticker
                      </div>
                    </div>
                    <button
                      onClick={startCamera}
                      className="px-4 py-2 bg-[#CADA03] hover:bg-[#B8C702] text-[#0A0B0E] text-xs font-black uppercase rounded-xl flex items-center gap-1.5 transition"
                    >
                      <Camera className="w-3.5 h-3.5 text-[#0A0B0E]" />
                      <span>Start Camera</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Camera Error Alert */}
              {cameraError && (
                <div className="p-3 bg-amber-950/40 border border-amber-500/40 rounded-xl text-amber-200 text-xs text-left leading-relaxed">
                  {cameraError}
                </div>
              )}

              {/* Camera Controls */}
              {cameraActive && (
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={stopCamera}
                    className="px-4 py-2 bg-[#1D222E] hover:bg-[#2A303C] text-xs font-bold text-[#94A3B8] hover:text-[#F8F9FA] rounded-xl flex items-center gap-1.5 transition"
                  >
                    <CameraOff className="w-3.5 h-3.5" />
                    <span>Stop Camera</span>
                  </button>
                  <button
                    onClick={startCamera}
                    className="px-4 py-2 bg-[#1D222E] hover:bg-[#2A303C] text-xs font-bold text-[#94A3B8] hover:text-[#F8F9FA] rounded-xl flex items-center gap-1.5 transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Restart View</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Quick Check-in Mode View */}
          {mode === 'button' && (
            <div className="space-y-4 text-center">
              <div className="relative mx-auto w-36 h-36 rounded-3xl bg-[#0A0B0E] border-2 border-dashed border-[#CADA03]/50 flex flex-col items-center justify-center p-4">
                <QrCode className="w-16 h-16 text-[#CADA03]" />
                <div className="absolute inset-x-0 bottom-2.5 text-[9px] font-black uppercase tracking-widest text-[#94A3B8]">
                  Entrance Station
                </div>
              </div>

              <div>
                <h2 className="text-base font-bold text-[#F8F9FA]">
                  Manual Entrance Check-In
                </h2>
                <p className="text-xs text-[#94A3B8] mt-1 max-w-xs mx-auto leading-relaxed">
                  Fast 1-tap check-in if your device camera is unavailable or permission was rejected.
                </p>
              </div>

              <button
                onClick={() => handleCheckIn()}
                disabled={loading}
                className="w-full py-3.5 px-6 bg-[#CADA03] hover:bg-[#B8C702] active:scale-[0.98] text-[#0A0B0E] font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition text-sm shadow-[0_4px_20px_rgba(202,218,3,0.35)] disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#0A0B0E]" />
                    <span>Recording Entrance...</span>
                  </>
                ) : (
                  <>
                    <QrCode className="w-4 h-4 text-[#0A0B0E]" />
                    <span>Check In Now</span>
                  </>
                )}
              </button>
            </div>
          )}

          <div className="pt-2 border-t border-[#2A303C] text-center">
            <p className="text-[11px] text-[#94A3B8]/70">
              One visit per calendar day (Asia/Kolkata). Sessions auto-close after 3 hours.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

