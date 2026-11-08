/**
 * SessionHistory — "Sessions" tab of the Stats page
 * One card per sale session (show or OneOff), newest first; tap → summary drawer.
 * Kept deliberately light: cards show only what tells sessions apart, the rest
 * lives in the drawer, and long lists / activity are revealed on demand.
 */

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Clock, Store } from 'lucide-react';
import { useMerchPad } from '../contexts/MerchPadContext';
import { useProjects } from '../contexts/ProjectContext';
import { AuditEntry, getDB, SaleSession } from '../lib/db';
import { RightDrawer } from './RightDrawer';
import { AuditTimeline } from './AuditTimeline';
import { SpeedRabbit } from './SpeedRabbit';
import { cn } from '../lib/utils';

type SaleItem = { variantId: string; variantName: string; qty: number; unitPrice: number; unitCost?: number };
type TypeFilter = 'all' | 'show' | 'oneoff';

interface SessionStats {
  revenue: number;
  units: number;
  cost: number;
  items: Map<string, { variantId: string; variantName: string; qty: number; revenue: number }>;
}

const PAGE = 15;

function money(n: number, currency: string) {
  const symbol = currency === 'USD' ? '$' : currency === 'GBP' ? '£' : '€';
  return `${symbol}${Number.isInteger(n) ? n : n.toFixed(2)}`;
}
const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const monthLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

function duration(s: SaleSession) {
  const ms = new Date(s.endedAt ?? Date.now()).getTime() - new Date(s.startedAt).getTime();
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function SessionIcon({ oneoff, size = 18 }: { oneoff: boolean; size?: number }) {
  return (
    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
      style={oneoff
        ? { background: 'rgba(251,191,36,0.15)', color: '#FBBF24' }
        : { background: 'rgba(107,92,255,0.15)', color: '#7C6DFF' }}>
      {oneoff ? <SpeedRabbit size={size - 2} /> : <Store size={size} />}
    </div>
  );
}

interface Props {
  /** Confirmed, not-undone sales of the active project (unfiltered) */
  saleEntries: AuditEntry[];
  /** Full audit log of the active project, newest first */
  auditEntries: AuditEntry[];
  /** The Stats page time filter — applied to session start times */
  inTimeRange: (ts: string) => boolean;
  currentCost: Map<string, number>;
  currency: string;
  productOf: (variantId: string) => string | undefined;
}

export function SessionHistory({ saleEntries, auditEntries, inTimeRange, currentCost, currency, productOf }: Props) {
  const { state } = useMerchPad();
  const { activeProject } = useProjects();
  const { shows, activeSession } = state;

  const [sessions, setSessions] = useState<SaleSession[]>([]);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [showEmpty, setShowEmpty] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeProject) return;
    let cancelled = false;
    getDB()
      .then(db => db.getAllFromIndex('sessions', 'by-project', activeProject.id))
      .then(all => { if (!cancelled) setSessions(all.sort((a, b) => b.startedAt.localeCompare(a.startedAt))); });
    return () => { cancelled = true; };
  }, [activeProject, activeSession]);

  const stats = useMemo(() => {
    const m = new Map<string, SessionStats>();
    for (const e of saleEntries) {
      const items = e.newValue as SaleItem[] | undefined;
      if (!Array.isArray(items)) continue;
      let st = m.get(e.sessionId);
      if (!st) { st = { revenue: 0, units: 0, cost: 0, items: new Map() }; m.set(e.sessionId, st); }
      for (const i of items) {
        st.revenue += i.qty * i.unitPrice;
        st.units += i.qty;
        st.cost += i.qty * (i.unitCost ?? currentCost.get(i.variantId) ?? 0);
        const row = st.items.get(i.variantId) ?? { variantId: i.variantId, variantName: i.variantName, qty: 0, revenue: 0 };
        row.qty += i.qty;
        row.revenue += i.qty * i.unitPrice;
        st.items.set(i.variantId, row);
      }
    }
    return m;
  }, [saleEntries, currentCost]);

  const isLive = (s: SaleSession) => s.status === 'active' && s.id === activeSession?.id;
  const isOneOff = (s: SaleSession) => s.sessionType === 'oneoff' || s.showId === 'oneoff';
  const showOf = (s: SaleSession) => shows.find(sh => sh.id === s.showId);
  const titleOf = (s: SaleSession) => isOneOff(s) ? 'OneOff Sale' : (showOf(s)?.name ?? 'Show');

  const inRange = useMemo(() => sessions.filter(s => isLive(s) || inTimeRange(s.startedAt)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessions, inTimeRange, activeSession]);
  const withSales = inRange.filter(s => isLive(s) || (stats.get(s.id)?.units ?? 0) > 0);
  const emptyCount = inRange.length - withSales.length;
  const pool = showEmpty ? inRange : withSales;

  const oneOffCount = pool.filter(isOneOff).length;
  const hasBothTypes = oneOffCount > 0 && oneOffCount < pool.length;
  const visible = pool.filter(s => typeFilter === 'all' || (typeFilter === 'oneoff') === isOneOff(s));

  const live = visible.find(isLive);
  const past = visible.filter(s => !isLive(s));
  const shown = past.slice(0, limit);

  const opened = sessions.find(s => s.id === openId) ?? null;

  if (sessions.length === 0) {
    return (
      <div className="text-center py-12">
        <Clock size={24} className="text-[#7B7F93] mx-auto mb-2" />
        <p className="text-sm text-[#7B7F93]">No sessions yet</p>
        <p className="text-xs text-[#4A4D5E] mt-1">Start a sale from the Office to see it here</p>
      </div>
    );
  }

  const card = (s: SaleSession) => {
    const st = stats.get(s.id);
    const oneoff = isOneOff(s);
    const liveNow = isLive(s);
    return (
      <button key={s.id} onClick={() => setOpenId(s.id)}
        className={cn('w-full mp-card p-3 flex items-center gap-3 text-left transition-colors', !st && !liveNow && 'opacity-60')}
        style={liveNow ? { borderColor: 'rgba(107,92,255,0.5)', boxShadow: '0 0 18px rgba(107,92,255,0.15)' } : undefined}>
        <SessionIcon oneoff={oneoff} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[#E6E7EB] flex items-center gap-1.5 min-w-0">
            <span className="truncate">{titleOf(s)}</span>
            {liveNow && (
              <span className="text-[9px] font-black tracking-wider px-1.5 py-0.5 rounded-md flex-shrink-0"
                style={{ background: 'rgba(74,222,128,0.15)', color: '#4ADE80' }}>LIVE</span>
            )}
          </p>
          <p className="text-xs text-[#7B7F93] truncate mt-0.5">
            {liveNow ? `Since ${timeLabel(s.startedAt)}` : `${dayLabel(s.startedAt)} · ${timeLabel(s.startedAt)}`} · {s.repName}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          {st ? (<>
            <p className="text-[15px] font-black text-[#4ADE80]" style={{ fontVariantNumeric: 'tabular-nums' }}>{money(st.revenue, currency)}</p>
            <p className="text-[11px] text-[#7B7F93]">{st.units} {st.units === 1 ? 'unit' : 'units'}</p>
          </>) : (
            <p className="text-xs text-[#7B7F93]">No sales</p>
          )}
        </div>
      </button>
    );
  };

  // Month headers only when the list spans more than one month
  const months = new Set(shown.map(s => monthLabel(s.startedAt)));
  let lastMonth = '';

  return (
    <div>
      {hasBothTypes && (
        <div className="flex gap-2 mb-3">
          {([
            ['all', `All · ${pool.length}`],
            ['show', `Shows · ${pool.length - oneOffCount}`],
            ['oneoff', `OneOff · ${oneOffCount}`],
          ] as [TypeFilter, string][]).map(([id, label]) => (
            <button key={id} onClick={() => { setTypeFilter(id); setLimit(PAGE); }}
              className={cn('px-3 py-1.5 rounded-full text-xs font-semibold transition-all',
                typeFilter === id ? 'text-white' : 'text-[var(--pill-text)]')}
              style={typeFilter === id
                ? { background: 'linear-gradient(135deg, #6B5CFF, #C026D3)' }
                : { background: 'var(--pill-bg)', border: '1px solid var(--pill-border)' }}>
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {live && card(live)}
        {shown.map(s => {
          const m = monthLabel(s.startedAt);
          const header = months.size > 1 && m !== lastMonth;
          lastMonth = m;
          return (
            <div key={s.id}>
              {header && <p className="text-xs font-semibold text-[#7B7F93] uppercase tracking-wider mt-4 mb-2">{m}</p>}
              {card(s)}
            </div>
          );
        })}
      </div>

      {!live && shown.length === 0 && (
        <p className="text-sm text-[#7B7F93] text-center py-8">No sessions in this period</p>
      )}

      {past.length > limit && (
        <button onClick={() => setLimit(n => n + PAGE)}
          className="w-full mt-3 py-3 rounded-xl text-sm font-semibold text-[var(--pill-text)]"
          style={{ border: '1px solid var(--pill-border)', background: 'var(--pill-bg)' }}>
          Show more ({past.length - limit})
        </button>
      )}

      {emptyCount > 0 && (
        <button onClick={() => setShowEmpty(v => !v)}
          className="w-full mt-3 text-xs text-[#7B7F93] hover:text-[#A4A7B5] transition-colors">
          {showEmpty ? 'Hide sessions without sales' : `${emptyCount} session${emptyCount > 1 ? 's' : ''} without sales hidden · show`}
        </button>
      )}

      {opened && (
        <SessionDrawer
          session={opened}
          title={titleOf(opened)}
          subtitle={isOneOff(opened) ? 'No show' : [showOf(opened)?.venue, showOf(opened)?.city].filter(Boolean).join(' · ') || undefined}
          oneoff={isOneOff(opened)}
          live={isLive(opened)}
          stats={stats.get(opened.id)}
          activity={auditEntries.filter(e => e.sessionId === opened.id)}
          currency={currency}
          productOf={productOf}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}

// ── Session summary drawer ─────────────────────────────────────────────────

const TOP_ITEMS = 5;

function SessionDrawer({ session, title, subtitle, oneoff, live, stats, activity, currency, productOf, onClose }: {
  session: SaleSession;
  title: string;
  subtitle?: string;
  oneoff: boolean;
  live: boolean;
  stats?: SessionStats;
  activity: AuditEntry[];
  currency: string;
  productOf: (variantId: string) => string | undefined;
  onClose: () => void;
}) {
  const [allItems, setAllItems] = useState(false);
  const [showActivity, setShowActivity] = useState(false);

  const items = useMemo(() => Array.from(stats?.items.values() ?? []).sort((a, b) => b.qty - a.qty), [stats]);
  const visibleItems = allItems ? items : items.slice(0, TOP_ITEMS);
  const profit = stats ? stats.revenue - stats.cost : 0;
  const timeline = activity;

  return (
    <RightDrawer open={true} onClose={onClose} title={title} subtitle={subtitle}>
      <div className="min-h-0 overflow-y-auto p-3 space-y-4">
        {/* When / who */}
        <div className="flex items-center gap-3">
          <SessionIcon oneoff={oneoff} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#E6E7EB]">
              {dayLabel(session.startedAt)} · {timeLabel(session.startedAt)}
              {session.endedAt ? ` → ${timeLabel(session.endedAt)}` : ''}
              <span className="text-[#7B7F93] font-normal"> · {live ? `live for ${duration(session)}` : duration(session)}</span>
            </p>
            <p className="text-xs text-[#7B7F93] truncate">
              {session.repName}{session.standName ? ` · ${session.standName}` : ''}
            </p>
          </div>
        </div>

        {/* Numbers */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Revenue', value: money(stats?.revenue ?? 0, currency), color: '#4ADE80' },
            { label: 'Units', value: String(stats?.units ?? 0), color: '#00E5FF' },
            { label: 'Profit', value: money(profit, currency), color: profit < 0 ? '#F87171' : '#C026D3' },
          ].map(k => (
            <div key={k.label} className="mp-card p-2.5">
              <p className="text-[10px] font-semibold text-[#7B7F93] uppercase tracking-wider">{k.label}</p>
              <p className="text-lg font-black leading-tight mt-0.5 truncate" style={{ color: k.color, fontVariantNumeric: 'tabular-nums' }}>{k.value}</p>
            </div>
          ))}
        </div>

        {/* What sold */}
        {items.length > 0 ? (
          <div>
            <p className="text-xs font-semibold text-[#7B7F93] uppercase tracking-wider mb-2">Sold</p>
            <div className="mp-card px-3 py-1">
              {visibleItems.map((i, idx) => {
                const product = productOf(i.variantId);
                const name = product && product !== i.variantName ? `${product} · ${i.variantName}` : i.variantName;
                return (
                  <div key={i.variantId} className={cn('flex items-center justify-between gap-3 py-2.5', idx > 0 && 'border-t border-[#24273A]')}>
                    <span className="text-sm font-semibold text-[#E6E7EB] truncate">{name}</span>
                    <span className="text-sm text-[#7B7F93] flex-shrink-0" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      ×{i.qty} · <span className="text-[#A4A7B5]">{money(i.revenue, currency)}</span>
                    </span>
                  </div>
                );
              })}
            </div>
            {items.length > TOP_ITEMS && (
              <button onClick={() => setAllItems(v => !v)} className="w-full mt-2 text-xs font-semibold text-[#7C6DFF]">
                {allItems ? 'Show less' : `Show all ${items.length}`}
              </button>
            )}
          </div>
        ) : (
          <p className="text-sm text-[#7B7F93] text-center py-4">No sales in this session</p>
        )}

        {/* Activity — collapsed by default */}
        {timeline.length > 0 && (
          <div>
            <button onClick={() => setShowActivity(v => !v)}
              className="w-full flex items-center justify-between py-2 text-xs font-semibold text-[#7B7F93] uppercase tracking-wider">
              <span className="flex items-center gap-2"><Clock size={13} /> Activity · {timeline.length}</span>
              {showActivity ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showActivity && <div className="mt-2"><AuditTimeline entries={timeline} productOf={productOf} /></div>}
          </div>
        )}
      </div>
    </RightDrawer>
  );
}
