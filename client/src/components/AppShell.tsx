/**
 * AppShell — persistent layout wrapper with bottom tab navigation
 * Design: "Neon Ledger" — dark glass bottom nav, Moshly accent colors
 */

import { Link, useLocation } from 'wouter';
import { ShoppingBag, Zap, BarChart3, Settings } from 'lucide-react';
import { useMerchPad } from '../contexts/MerchPadContext';
import { cn } from '../lib/utils';

const NAV_ITEMS = [
  { path: '/', label: 'Office', icon: ShoppingBag },
  { path: '/tally', label: 'Tally', icon: Zap },
  { path: '/detail', label: 'Detail', icon: BarChart3 },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { state } = useMerchPad();
  const { syncStatus, pendingSyncCount, activeSession } = state;

  return (
    <div className="flex flex-col min-h-screen bg-[#0E0F14]">
      {/* Top status bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-4 py-3"
        style={{ background: 'rgba(14, 15, 20, 0.95)', backdropFilter: 'blur(20px)', borderBottom: '1px solid #24273A' }}>
        <div className="flex items-center gap-2">
          <span className="font-bold text-base tracking-tight text-[#E6E7EB]" style={{ fontFamily: 'Inter, sans-serif' }}>
            <span className="mp-gradient-text">Merch</span>Pad
          </span>
          {activeSession && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: 'rgba(107, 92, 255, 0.15)', color: '#7C6DFF', border: '1px solid rgba(107, 92, 255, 0.3)' }}>
              LIVE
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {pendingSyncCount > 0 && (
            <span className="text-xs font-mono text-[#7B7F93]">
              {pendingSyncCount} pending
            </span>
          )}
          <div className="flex items-center gap-1.5">
            <div className={cn('mp-sync-dot', {
              'mp-sync-dot-online': syncStatus === 'online',
              'mp-sync-dot-offline': syncStatus === 'offline',
              'mp-sync-dot-syncing': syncStatus === 'syncing',
            })} />
            <span className="text-xs text-[#7B7F93] capitalize">{syncStatus}</span>
          </div>
          {state.repName && (
            <span className="text-xs text-[#A4A7B5] font-medium">{state.repName}</span>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-auto pb-20">
        {children}
      </main>

      {/* Bottom navigation */}
      <nav className="mp-bottom-nav fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around px-2 py-2 safe-area-pb">
        {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
          const isActive = path === '/' ? location === '/' : location.startsWith(path);
          return (
            <Link key={path} href={path}>
              <button
                className={cn(
                  'flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all duration-150',
                  isActive
                    ? 'text-[#7C6DFF]'
                    : 'text-[#7B7F93] hover:text-[#A4A7B5]'
                )}
                style={isActive ? { background: 'rgba(107, 92, 255, 0.12)' } : {}}
              >
                <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                <span className="text-[10px] font-semibold tracking-wide uppercase">{label}</span>
              </button>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
