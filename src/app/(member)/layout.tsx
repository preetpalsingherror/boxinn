'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Home, QrCode, Calendar, Dumbbell, User, LogOut, Loader2 } from 'lucide-react';
import clsx from 'clsx';

export default function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [userName, setUserName] = useState<string>('');

  useEffect(() => {
    // Fast-path: check sessionStorage cache to eliminate layout flash/lag on navigation
    try {
      const cached = sessionStorage.getItem('boxinn_member_session');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.role === 'MEMBER') {
          setUserName(parsed.fullName || '');
          setAuthorized(true);
          setChecking(false);
        }
      }
    } catch {
      // ignore storage errors
    }

    async function verifyMember() {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          sessionStorage.removeItem('boxinn_member_session');
          window.location.href = '/login';
          return;
        }
        const data = await res.json();
        const user = data.data?.user;
        // Strict Role Separation: Admin accounts belong strictly in /admin, never in member profile/portal
        if (user?.role === 'ADMIN') {
          sessionStorage.removeItem('boxinn_member_session');
          window.location.href = '/admin';
          return;
        }
        sessionStorage.setItem(
          'boxinn_member_session',
          JSON.stringify({ role: user?.role || 'MEMBER', fullName: user?.fullName || '' })
        );
        setUserName(user?.fullName || '');
        setAuthorized(true);
      } catch {
        window.location.href = '/login';
      } finally {
        setChecking(false);
      }
    }
    verifyMember();
  }, []);

  const handleLogout = async () => {
    try {
      sessionStorage.removeItem('boxinn_member_session');
      sessionStorage.removeItem('boxinn_admin_session');
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login';
    } catch {
      window.location.href = '/login';
    }
  };

  const navItems = [
    { label: 'Home', href: '/home', icon: Home },
    { label: 'Check-In', href: '/checkin', icon: QrCode, highlight: true },
    { label: 'History', href: '/attendance', icon: Calendar },
    { label: 'Guides', href: '/machines', icon: Dumbbell },
    { label: 'Profile', href: '/profile', icon: User },
  ];

  if (checking) {
    return (
      <div className="min-h-screen bg-[#0A0B0E] flex items-center justify-center text-[#CADA03]">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!authorized) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#0A0B0E] text-[#F8F9FA] flex flex-col justify-between">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-[#0A0B0E]/95 backdrop-blur-md border-b border-[#2A303C]/80 px-4 py-2.5">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/home" prefetch={true} className="flex items-center gap-2.5 group">
            <img 
              src="/brand/boxinn-horizontal-dark.png" 
              alt="BOX INN - Rise Above The Average" 
              className="h-8 w-auto object-contain transition group-hover:opacity-90" 
            />
            <span className="text-[10px] px-2 py-0.5 bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 rounded font-bold tracking-wider uppercase">
              Athlete Portal
            </span>
          </Link>

          {/* Desktop Quick Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== '/home' && pathname?.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={true}
                  className={clsx(
                    'px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition',
                    isActive
                      ? 'bg-[#CADA03] text-[#0A0B0E]'
                      : 'text-[#94A3B8] hover:text-[#F8F9FA] hover:bg-[#14171F]'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            {userName && (
              <span className="text-xs text-[#94A3B8] hidden sm:inline font-medium truncate max-w-[120px]">
                {userName.split(' ')[0]}
              </span>
            )}
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-2 text-[#94A3B8] hover:text-[#F8F9FA] hover:bg-[#14171F] rounded-lg transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-2xl w-full mx-auto p-4 sm:p-6 pb-24 md:pb-8">
        {children}
      </main>

      {/* Mobile Bottom Navigation Bar (Persistent Thumb Zone) */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#14171F]/95 backdrop-blur-lg border-t border-[#2A303C] py-2 px-3 md:hidden">
        <div className="max-w-md mx-auto grid grid-cols-5 gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/home' && pathname?.startsWith(item.href));

            if (item.highlight) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={true}
                  className="flex flex-col items-center justify-center -mt-5"
                >
                  <div className="w-12 h-12 rounded-full bg-[#CADA03] hover:bg-[#B8C702] text-[#0A0B0E] flex items-center justify-center shadow-[0_4px_16px_rgba(202,218,3,0.4)] active:scale-95 transition">
                    <Icon className="w-6 h-6 stroke-[2.5]" />
                  </div>
                  <span className="text-[10px] font-bold text-[#CADA03] mt-1">
                    {item.label}
                  </span>
                </Link>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={true}
                className={clsx(
                  'flex flex-col items-center justify-center py-1 rounded-xl transition min-h-[44px]',
                  isActive ? 'text-[#CADA03]' : 'text-[#94A3B8] hover:text-[#F8F9FA]'
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium mt-1 leading-none">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
