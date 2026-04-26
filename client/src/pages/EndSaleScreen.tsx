/**
 * EndSaleScreen — explicit "Stop Sale → Archive" flow
 * Design: "Neon Ledger" — full-screen confirmation with session summary
 * Triggered from Tally Counter via a prominent "Stop Sale" button
 * Shows: units sold, revenue, top items, duration, then archives to history
 */

import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Archive, TrendingUp, Clock, Package, ChevronRight, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useMerchPad } from '../contexts/MerchPadContext';
import { getDB, TallyBatch } from '../lib/db';

function formatDuration(startIso: string): string {
  const ms = Date.now() - new Date(startIso).getTime();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

interface SessionSummary {
  totalBatches: number;
  totalUnits: number;
  totalRevenue: number;
  topItems: Array<{ name: string; qty: number; revenue: number }>;
  batches: TallyBatch[];
}

async function buildSummary(sessionId: string): Promise<SessionSummary> {
  const db = await getDB();
  const batches = (await db.getAllFromIndex('tallyBatches', 'by-session', sessionId))
    .filter(b => b.status !== 'voided');

  const itemMap: Record<string, { name: string; qty: number; revenue: number }> = {};
  let totalUnits = 0;
  let totalRevenue = 0;

  for (const batch of batches) {
    for (const item of batch.items) {
      totalUnits += item.qty;
      totalRevenue += item.qty * item.unitPrice;
      if (!itemMap[item.variantId]) {
        itemMap[item.variantId] = { name: item.variantName, qty: 0, revenue: 0 };
      }
      itemMap[item.variantId].qty += item.qty;
      itemMap[item.variantId].revenue += item.qty * item.unitPrice;
    }
  }

  const topItems = Object.values(itemMap)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  return { totalBatches: batches.length, totalUnits, totalRevenue, topItems, batches };
}

export default function EndSaleScreen() {
  const [, navigate] = useLocation();
  const { state, endSession } = useMerchPad();
  const { activeSession, settings } = state;
  const currency = settings.currency ?? 'EUR';
  const symbol = currency === 'USD' ? '$' : currency === 'GBP' ? '£' : '€';

  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (!activeSession) { navigate('/tally'); return; }
    buildSummary(activeSession.id).then(s => {
      setSummary(s);
      setLoading(false);
    });
  }, [activeSession, navigate]);

  async function handleArchive() {
    setConfirming(true);
    await endSession();
    setConfirmed(true);
    setConfirming(false);
    toast.success('Session archived successfully');
    setTimeout(() => navigate('/'), 1500);
  }

  if (!activeSession) return null;

  return (
    <div className="min-h-full animate-fade-in">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <button onClick={() => navigate('/tally')}
          className="flex items-center gap-1 text-xs text-[#7B7F93] hover:text-[#A4A7B5] mb-3 transition-colors">
          ← Back to Tally
        </button>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.25)' }}>
            <Archive size={20} className="text-[#F87171]" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[#F87171] uppercase tracking-widest">Stop Sale</p>
            <h1 className="text-xl font-black text-[#E6E7EB] leading-tight" style={{ letterSpacing: '-0.03em' }}>
              Archive Session
            </h1>
          </div>
        </div>
        <p className="text-sm text-[#7B7F93]">
          Review the session summary before archiving. This action cannot be undone.
        </p>
      </div>

      {/* Session meta */}
      <div className="mx-4 mt-3 rounded-xl p-3 flex items-center gap-3"
        style={{ background: '#1B1E2E', border: '1px solid #2D3048' }}>
        <Clock size={14} className="text-[#7B7F93] flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#E6E7EB]">{activeSession.repName}</p>
          <p className="text-xs text-[#7B7F93]">
            {activeSession.standName ? `${activeSession.standName} · ` : ''}
            Started {formatTime(activeSession.startedAt)} · {formatDuration(activeSession.startedAt)} ago
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 rounded-full border-2 border-[#6B5CFF] border-t-transparent animate-spin" />
        </div>
      ) : summary && (
        <div className="px-4 mt-4 space-y-4">
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Batches', value: summary.totalBatches, icon: Package },
              { label: 'Units', value: summary.totalUnits, icon: TrendingUp },
              { label: 'Revenue', value: `${symbol}${summary.totalRevenue.toFixed(2)}`, icon: TrendingUp },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="mp-card p-3 text-center">
                <p className="text-xs text-[#7B7F93] uppercase tracking-wider mb-1">{label}</p>
                <p className="text-lg font-black text-[#E6E7EB] leading-none" style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Top items */}
          {summary.topItems.length > 0 && (
            <div className="mp-card overflow-hidden">
              <div className="px-3 py-2 border-b border-[#24273A]">
                <p className="text-xs font-semibold text-[#7B7F93] uppercase tracking-wider">Top Items</p>
              </div>
              <div className="divide-y divide-[#1B1E2E]">
                {summary.topItems.map((item, i) => (
                  <div key={item.name} className="flex items-center justify-between px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-bold text-[#7B7F93] w-4 text-center">{i + 1}</span>
                      <span className="text-sm text-[#A4A7B5]">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-[#E6E7EB]">×{item.qty}</span>
                      <span className="text-xs text-[#7B7F93]">{symbol}{item.revenue.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {summary.totalBatches === 0 && (
            <div className="rounded-xl p-4 flex items-center gap-3"
              style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)' }}>
              <AlertTriangle size={16} className="text-[#FBBF24] flex-shrink-0" />
              <p className="text-sm text-[#A4A7B5]">No sales were recorded in this session.</p>
            </div>
          )}

          {/* Archive CTA */}
          <div className="rounded-2xl p-4 space-y-3"
            style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)' }}>
            <div className="flex items-start gap-2">
              <AlertTriangle size={14} className="text-[#F87171] flex-shrink-0 mt-0.5" />
              <p className="text-xs text-[#A4A7B5] leading-relaxed">
                Archiving will close this session permanently. The session data, audit trail, and all sale records will be preserved in history.
              </p>
            </div>

            {confirmed ? (
              <div className="flex items-center justify-center gap-2 py-3">
                <div className="w-5 h-5 rounded-full flex items-center justify-center bg-[#4ADE80]">
                  <span className="text-black text-xs font-bold">✓</span>
                </div>
                <span className="text-sm font-bold text-[#4ADE80]">Session Archived</span>
              </div>
            ) : (
              <button
                onClick={handleArchive}
                disabled={confirming}
                className="w-full py-4 rounded-xl text-base font-black text-white flex items-center justify-center gap-2 transition-all active:scale-98 disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #F87171 0%, #C026D3 100%)', boxShadow: '0 0 24px rgba(248,113,113,0.25)' }}>
                {confirming ? (
                  <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                ) : (
                  <><Archive size={18} /> Archive Session</>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="h-8" />
    </div>
  );
}
