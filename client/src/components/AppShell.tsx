/**
 * AppShell — persistent layout wrapper with bottom tab navigation
 * Design: "Neon Ledger" — dark glass bottom nav, Moshly accent colors
 */

import { Link, useLocation } from 'wouter';
import { ShoppingBag, Zap, BarChart3, Settings, ArrowLeft } from 'lucide-react';
import { cn } from '../lib/utils';
import logoUrl from '../../../assets/moshly-merchpad-logo-svg.svg';

const HUB_URL = import.meta.env.VITE_MOSHLY_HUB_URL ?? 'https://moshly.io';

const NAV_ITEMS = [
  { path: '/', label: 'Office', icon: ShoppingBag },
  { path: '/tally', label: 'Tally', icon: Zap },
  { path: '/detail', label: 'Detail', icon: BarChart3 },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen bg-background text-foreground lg:flex lg:justify-center">
    <div className="flex flex-col min-h-screen w-full lg:max-w-[430px] lg:relative">
      {/* Top bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-4 py-3"
        style={{ background: 'var(--popover)', opacity: 0.95, backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border)' }}>

        {/* Logo + wordmark */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <img src={logoUrl} alt="" className="w-6 h-6" />
          <span className="font-bold text-base tracking-tight text-foreground" style={{ fontFamily: 'Inter, sans-serif' }}>
            <span className="mp-gradient-text">Merch</span>Pad
          </span>
        </div>

        {/* Back to Moshly */}
        <a
          href={HUB_URL}
          className="flex items-center gap-1.5 text-xs font-medium text-[#7B7F93] hover:text-foreground transition-colors"
        >
          <ArrowLeft size={13} />
          Back to Moshly
        </a>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-auto pb-20 lg:pb-0">
        {children}
      </main>

      {/* Bottom navigation */}
      <nav className="mp-bottom-nav fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around px-2 py-2 lg:sticky lg:bottom-0">
        {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
          const isActive = path === '/' ? location === '/' : location.startsWith(path);
          return (
            <Link key={path} href={path}>
              <button
                className={cn(
                  'flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all duration-150',
                  isActive ? 'text-[#7C6DFF]' : 'text-[#7B7F93] hover:text-[#A4A7B5]'
                )}
                style={isActive ? { background: 'rgba(107, 92, 255, 0.12)' } : {}}>
                <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                <span className="text-[10px] font-semibold tracking-wide uppercase">{label}</span>
              </button>
            </Link>
          );
        })}
      </nav>
    </div>
    </div>
  );
}
