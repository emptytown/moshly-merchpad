/**
 * ExportSheet — self-contained export action sheet
 * Triggered by the Export button in DetailInfo; slides up from the bottom.
 * Options: Last Sale CSV | All Sales CSV | Date Range CSV | Export PDF (placeholder)
 */

import { useState, useRef } from 'react';
import { Download, FileText, Clock, CalendarRange, FileSpreadsheet, X, ExternalLink, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { AuditEntry } from '../lib/db';
import { cn } from '../lib/utils';

// ── CSV helpers ────────────────────────────────────────────────────────────

function buildSaleRows(entries: AuditEntry[]) {
  const rows: string[][] = [
    ['Timestamp', 'Batch ID', 'Rep', 'Variant', 'Qty', 'Unit Price', 'Line Total'],
  ];
  for (const e of entries) {
    if (e.action !== 'tally_confirmed') continue;
    const items = e.newValue as Array<{
      variantName?: string; qty: number; unitPrice: number;
    }> | undefined;
    if (!items) continue;
    for (const i of items) {
      rows.push([
        e.timestamp,
        e.entityId,
        e.actorName,
        i.variantName ?? '',
        String(i.qty),
        i.unitPrice.toFixed(2),
        (i.qty * i.unitPrice).toFixed(2),
      ]);
    }
  }
  return rows;
}

function downloadCSV(rows: string[][], filename: string) {
  if (rows.length <= 1) { toast.warning('No sales data to export'); return; }
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(`Exported: ${filename}`);
}

// ── Date range picker ──────────────────────────────────────────────────────

interface DateRangePickerProps {
  onExport: (from: string, to: string) => void;
  onBack: () => void;
}

function DateRangePicker({ onExport, onBack }: DateRangePickerProps) {
  const today = new Date().toISOString().split('T')[0];
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <button onClick={onBack} className="text-[#7B7F93] hover:text-[#A4A7B5] transition-colors text-xs">
          ← Back
        </button>
        <span className="text-sm font-bold text-[#E6E7EB]">Select Date Range</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-[#7B7F93] uppercase tracking-wider mb-1.5">From</label>
          <input
            type="date"
            value={from}
            max={to}
            onChange={e => setFrom(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm text-[#E6E7EB] bg-[#0E0F14] border border-[#2D3048] focus:border-[#6B5CFF] focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#7B7F93] uppercase tracking-wider mb-1.5">To</label>
          <input
            type="date"
            value={to}
            min={from}
            max={today}
            onChange={e => setTo(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm text-[#E6E7EB] bg-[#0E0F14] border border-[#2D3048] focus:border-[#6B5CFF] focus:outline-none"
          />
        </div>
      </div>

      <button
        onClick={() => onExport(from, to)}
        className="w-full py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2"
        style={{ background: 'linear-gradient(135deg, #6B5CFF, #C026D3)' }}>
        <Download size={14} /> Export CSV
      </button>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

interface ExportSheetProps {
  auditEntries: AuditEntry[];
}

type View = 'menu' | 'daterange';

export function ExportButton({ auditEntries }: ExportSheetProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>('menu');

  function close() { setOpen(false); setTimeout(() => setView('menu'), 300); }

  // ── Export actions ───────────────────────────────────────────────────────

  function exportLastSale() {
    const last = auditEntries.find(e => e.action === 'tally_confirmed');
    if (!last) { toast.warning('No sales found'); return; }
    const rows = buildSaleRows([last]);
    const date = new Date(last.timestamp).toISOString().split('T')[0];
    downloadCSV(rows, `merchpad-last-sale-${date}.csv`);
    close();
  }

  function exportAllSales() {
    const sales = auditEntries.filter(e => e.action === 'tally_confirmed');
    const rows = buildSaleRows(sales);
    downloadCSV(rows, `merchpad-all-sales-${new Date().toISOString().split('T')[0]}.csv`);
    close();
  }

  function exportDateRange(from: string, to: string) {
    const fromDate = new Date(from);
    const toDate = new Date(to); toDate.setHours(23, 59, 59, 999);
    const filtered = auditEntries.filter(e => {
      if (e.action !== 'tally_confirmed') return false;
      const d = new Date(e.timestamp);
      return d >= fromDate && d <= toDate;
    });
    const rows = buildSaleRows(filtered);
    downloadCSV(rows, `merchpad-sales-${from}-to-${to}.csv`);
    close();
  }

  const MENU_ITEMS = [
    {
      id: 'last',
      icon: Clock,
      label: 'Export Last Sale',
      sub: 'Most recent confirmed batch',
      color: '#6B5CFF',
      action: () => exportLastSale(),
    },
    {
      id: 'all',
      icon: FileSpreadsheet,
      label: 'Export All Sales',
      sub: 'Every confirmed batch as CSV',
      color: '#4ADE80',
      action: () => exportAllSales(),
    },
    {
      id: 'range',
      icon: CalendarRange,
      label: 'Export Date Range',
      sub: 'Pick a custom date range',
      color: '#00E5FF',
      action: () => setView('daterange'),
      chevron: true,
    },
    {
      id: 'pdf',
      icon: FileText,
      label: 'Export PDF',
      sub: 'Requires Moshly Hub — coming soon',
      color: '#FBBF24',
      disabled: true,
      badge: 'Hub',
      action: () => toast.info('PDF export is available with a Moshly Hub plan'),
    },
  ];

  return (
    <>
      {/* Trigger button — unchanged appearance */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#7B7F93] hover:text-[#E6E7EB] transition-colors"
        style={{ border: '1px solid #2D3048' }}>
        <Download size={13} /> Export
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40"
          style={{ background: 'rgba(14,15,20,0.7)', backdropFilter: 'blur(6px)' }}
          onClick={close}
        />
      )}

      {/* Sheet */}
      <div
        className={cn(
          'fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ease-out',
          open ? 'translate-y-0' : 'translate-y-full'
        )}
        style={{ maxWidth: 480, margin: '0 auto' }}>
        <div className="rounded-t-2xl overflow-hidden" style={{ background: '#141624', border: '1px solid #2D3048' }}>

          {/* Handle + header */}
          <div className="flex items-center justify-between px-4 pt-3 pb-3 border-b border-[#24273A]">
            <div className="flex items-center gap-2">
              <Download size={15} className="text-[#7C6DFF]" />
              <span className="text-sm font-bold text-[#E6E7EB]">Export</span>
            </div>
            <button onClick={close} className="text-[#7B7F93] hover:text-[#E6E7EB] p-1">
              <X size={15} />
            </button>
          </div>

          <div className="p-4">
            {view === 'menu' && (
              <div className="space-y-1">
                {MENU_ITEMS.map(item => (
                  <button
                    key={item.id}
                    onClick={item.action}
                    disabled={item.disabled}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all',
                      item.disabled
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:bg-[#1B1E2E] active:scale-[0.98]'
                    )}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${item.color}15` }}>
                      <item.icon size={16} style={{ color: item.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-[#E6E7EB]">{item.label}</p>
                        {item.badge && (
                          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold"
                            style={{ background: 'rgba(251,191,36,0.15)', color: '#FBBF24', border: '1px solid rgba(251,191,36,0.25)' }}>
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#7B7F93]">{item.sub}</p>
                    </div>
                    {item.chevron && <ChevronRight size={14} className="text-[#7B7F93] flex-shrink-0" />}
                    {item.disabled && <ExternalLink size={12} className="text-[#7B7F93] flex-shrink-0" />}
                  </button>
                ))}
              </div>
            )}

            {view === 'daterange' && (
              <DateRangePicker
                onExport={exportDateRange}
                onBack={() => setView('menu')}
              />
            )}
          </div>

          {/* Bottom safe area — clears the 64px bottom nav bar */}
          <div className="pb-20" />
        </div>
      </div>
    </>
  );
}
