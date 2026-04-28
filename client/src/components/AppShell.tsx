/**
 * AppShell — persistent layout wrapper with bottom tab navigation
 * Design: "Neon Ledger" — dark glass bottom nav, Moshly accent colors
 * Shows active project name + color dot in the top bar
 */

import { Link, useLocation } from 'wouter';
import { ShoppingBag, Zap, BarChart3, Settings } from 'lucide-react';
import { useMerchPad } from '../contexts/MerchPadContext';
import { useProjects } from '../contexts/ProjectContext';
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
  const { activeProject } = useProjects();
  const { syncStatus, pendingSyncCount, activeSession } = state;

  return (
    <div className="min-h-screen bg-background text-foreground lg:flex lg:justify-center">
    <div className="flex flex-col min-h-screen w-full lg:max-w-[430px] lg:relative">
      {/* Top status bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-4 py-3"
        style={{ background: 'var(--popover)', opacity: 0.95, backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Logo */}
          <span className="font-bold text-base tracking-tight text-foreground flex-shrink-0" style={{ fontFamily: 'Inter, sans-serif' }}>
            <span className="mp-gradient-text">Merch</span>Pad
          </span>

          {/* Active project pill */}
          {activeProject && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full min-w-0"
              style={{ background: `${activeProject.color}15`, border: `1px solid ${activeProject.color}30` }}>
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: activeProject.color }} />
              <span className="text-xs font-semibold truncate max-w-[100px]" style={{ color: activeProject.color }}>
                {activeProject.name}
              </span>
            </div>
          )}

          {activeSession && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
              style={{ background: 'rgba(74, 222, 128, 0.12)', color: '#4ADE80', border: '1px solid rgba(74,222,128,0.25)' }}>
              LIVE
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
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
            <span className="text-xs text-[#A4A7B5] font-medium hidden sm:block">{state.repName}</span>
          )}
        </div>
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
