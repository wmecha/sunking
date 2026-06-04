'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  MapPin,
  Map,
  Upload,
  GitCompare,
  Download,
  ShieldCheck,
  ClipboardList,
  Settings,
  LogOut,
  Menu,
  X,
  ExternalLink,
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/tracker', label: 'Tracker', icon: MapPin },
  { href: '/map', label: 'Map', icon: Map },
  { href: '/import', label: 'Import', icon: Upload },
  { href: '/reconciliation', label: 'Reconciliation', icon: GitCompare },
  { href: '/export', label: 'Export', icon: Download },
];

const bottomNavItems = [
  { href: '/quality-control', label: 'Quality Control', icon: ShieldCheck },
  { href: '/audit', label: 'Audit Log', icon: ClipboardList },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  function navLink(href: string, label: string, Icon: React.ElementType) {
    const isActive = pathname === href || pathname.startsWith(href + '/');
    return (
      <Link
        key={href}
        href={href}
        onClick={() => setMobileOpen(false)}
        className={`
          flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors duration-150
          ${isActive
            ? 'bg-[#F5C000] text-[#1C2B3A]'
            : 'text-white/70 hover:text-white hover:bg-white/10'
          }
        `}
      >
        <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
        {label}
      </Link>
    );
  }

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="px-5 py-6 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">☀</span>
          <div>
            <span className="text-[#F5C000] font-bold text-lg tracking-tight leading-none">SUN KING</span>
            <p className="text-white/50 text-xs mt-0.5 leading-none">Location Intelligence</p>
          </div>
        </div>
        {/* Close button — only visible on mobile */}
        <button
          className="md:hidden text-white/60 hover:text-white p-1"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          <X size={20} />
        </button>
      </div>

      {/* Primary Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => navLink(href, label, Icon))}

        {/* Divider */}
        <div className="pt-4 pb-2">
          <p className="px-3 text-[10px] font-semibold text-white/30 uppercase tracking-widest">Tools</p>
        </div>

        {bottomNavItems.map(({ href, label, icon: Icon }) => navLink(href, label, Icon))}
      </nav>

      {/* Escalate + Logout */}
      <div className="px-3 py-4 border-t border-white/10 space-y-1">
        <a
          href="https://business.google.com/groups/117940732771312023601/locations"
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setMobileOpen(false)}
          className="flex w-full items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-[#F5C000] hover:text-yellow-300 hover:bg-yellow-500/10 transition-colors duration-150"
        >
          <ExternalLink size={18} />
          Go to GBP Locations
        </a>
        <a
          href="https://support.google.com/business/gethelp"
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setMobileOpen(false)}
          className="flex w-full items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-red-300 hover:text-red-200 hover:bg-red-500/10 transition-colors duration-150"
        >
          <ExternalLink size={18} />
          Escalate to Google
        </a>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-white/60 hover:text-white hover:bg-white/10 transition-colors duration-150"
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger button — shown only on small screens */}
      <button
        className="md:hidden fixed top-3 left-3 z-50 p-2 rounded-md bg-[#1C2B3A] text-white shadow-lg"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — always visible on md+; slide-in drawer on mobile */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-40
          w-60 flex-shrink-0 bg-[#1C2B3A] min-h-screen flex flex-col
          transition-transform duration-200 ease-in-out
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
