'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  ShieldCheck, 
  Users, 
  Calendar, 
  Dumbbell, 
  Megaphone, 
  LayoutDashboard, 
  LogOut, 
  Loader2
} from 'lucide-react';
import clsx from 'clsx';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const [adminName, setAdminName] = useState<string>('');

  useEffect(() => {
    // Fast-path: check sessionStorage cache to eliminate layout flash/lag on navigation
    try {
      const cached = sessionStorage.getItem('boxinn_admin_session');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.role === 'ADMIN') {
          setAdminName(parsed.fullName || 'Admin');
          setAuthorized(true);
          setChecking(false);
        }
      }
    } catch {
      // ignore storage errors
    }

    async function verifyAdmin() {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          sessionStorage.removeItem('boxinn_admin_session');
          window.location.href = '/login';
          return;
        }
        const data = await res.json();
        const user = data.data?.user;
        // Strict Role Separation: Members can NEVER access /admin
        if (user?.role !== 'ADMIN') {
          sessionStorage.removeItem('boxinn_admin_session');
          window.location.href = '/home';
          return;
        }
        sessionStorage.setItem(
          'boxinn_admin_session',
          JSON.stringify({ role: 'ADMIN', fullName: user.fullName || 'Admin' })
        );
        setAdminName(user.fullName || 'Admin');
        setAuthorized(true);
      } catch {
        window.location.href = '/login';
      } finally {
        setChecking(false);
      }
    }
    verifyAdmin();
  }, []);

  const handleLogout = async () => {
    try {
      sessionStorage.removeItem('boxinn_admin_session');
      sessionStorage.removeItem('boxinn_member_session');
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login';
    } catch {
      window.location.href = '/login';
    }
  };

  const navItems = [
    { label: 'Overview', href: '/admin', icon: LayoutDashboard },
    { label: 'Members', href: '/admin/members', icon: Users },
    { label: 'Attendance', href: '/admin/attendance', icon: Calendar },
    { label: 'Equipment', href: '/admin/machines', icon: Dumbbell },
    { label: 'Announcements', href: '/admin/announcements', icon: Megaphone },
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
    <div className="min-h-screen bg-[#0A0B0E] text-[#F8F9FA] flex flex-col">
      {/* Admin Top Header */}
      <header className="sticky top-0 z-40 bg-[#0A0B0E]/95 backdrop-blur-md border-b border-[#2A303C] px-4 py-2.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin" prefetch={true} className="flex items-center gap-3 group">
              <img 
                src="/brand/boxinn-horizontal-dark.png" 
                alt="BOX INN Control Console" 
                className="h-7 w-auto object-contain transition group-hover:opacity-90" 
              />
              <span className="text-[10px] px-2 py-0.5 bg-[#CADA03]/15 text-[#CADA03] border border-[#CADA03]/40 rounded font-black tracking-wider uppercase flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                <span>Staff Admin Console</span>
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            {adminName && (
              <span className="text-xs font-semibold text-[#94A3B8] hidden sm:inline">
                {adminName}
              </span>
            )}

            <button
              onClick={handleLogout}
              className="px-2.5 py-1.5 text-xs font-bold text-[#94A3B8] hover:text-[#F8F9FA] bg-[#14171F] hover:bg-[#1D222E] border border-[#2A303C] rounded-lg flex items-center gap-1.5 transition"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Admin Nav Sub-bar */}
      <div className="bg-[#14171F] border-b border-[#2A303C] px-4 overflow-x-auto">
        <div className="max-w-6xl mx-auto flex items-center gap-1 py-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={true}
                className={clsx(
                  'px-3.5 py-2 rounded-xl text-xs font-black tracking-wide flex items-center gap-2 transition whitespace-nowrap uppercase',
                  isActive
                    ? 'bg-[#CADA03] text-[#0A0B0E] shadow-[0_2px_10px_rgba(202,218,3,0.3)]'
                    : 'text-[#94A3B8] hover:text-[#F8F9FA] hover:bg-[#1D222E]'
                )}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Admin Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6">
        {children}
      </main>
    </div>
  );
}
