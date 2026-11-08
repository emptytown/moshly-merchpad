/**
 * AuditTimeline — vertical activity list (sales, undos, sessions, stock moves)
 * Shared by the Stats page and the session detail drawer.
 */

import { Clock } from 'lucide-react';
import { AuditEntry } from '../lib/db';

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  tally_confirmed: { label: 'Sale', color: '#4ADE80' },
  tally_voided: { label: 'Voided', color: '#F87171' },
  stock_adjusted: { label: 'Adjustment', color: '#FBBF24' },
  stock_transferred: { label: 'Transfer', color: '#00E5FF' },
  session_started: { label: 'Session Start', color: '#6B5CFF' },
  session_ended: { label: 'Session End', color: '#7B7F93' },
  tally_undo: { label: 'Undo', color: '#F87171' },
};

export type AuditItem = { variantId: string; variantName: string; qty: number };

// Sale / void entries carry their line items in newValue / oldValue — use them to name what was sold
export function auditItems(entry: AuditEntry): AuditItem[] {
  const v = (entry.newValue ?? entry.oldValue) as unknown;
  if (!Array.isArray(v)) return [];
  return v.filter((i): i is AuditItem => !!i && typeof i === 'object' && 'variantName' in i && 'qty' in i);
}

export function auditItemLabel(items: AuditItem[], productOf: (variantId: string) => string | undefined): string {
  return items.map(i => {
    const product = productOf(i.variantId);
    const name = product && product !== i.variantName ? `${product} · ${i.variantName}` : i.variantName;
    return `${name} ×${i.qty}`;
  }).join(', ');
}

export function AuditTimeline({ entries, productOf }: { entries: AuditEntry[]; productOf: (variantId: string) => string | undefined }) {
  if (entries.length === 0) return (
    <div className="text-center py-8">
      <Clock size={24} className="text-[#7B7F93] mx-auto mb-2" />
      <p className="text-sm text-[#7B7F93]">No activity yet</p>
    </div>
  );
  return (
    <div className="space-y-0">
      {entries.map((entry, i) => {
        const meta = ACTION_LABELS[entry.action] ?? { label: entry.action, color: '#7B7F93' };
        return (
          <div key={entry.id} className="flex gap-3 pb-4 relative">
            {i < entries.length - 1 && <div className="absolute left-[11px] top-6 bottom-0 w-px bg-[#24273A]" />}
            <div className="w-5 h-5 rounded-full flex-shrink-0 mt-0.5 flex items-center justify-center"
              style={{ background: `${meta.color}20`, border: `1px solid ${meta.color}40` }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-xs font-bold" style={{ color: meta.color }}>{meta.label}</span>
                  {(() => {
                    const items = auditItems(entry);
                    // "by X" is already shown below — drop it from the description
                    const suffix = ` by ${entry.actorName}`;
                    const desc = entry.description.endsWith(suffix) ? entry.description.slice(0, -suffix.length) : entry.description;
                    return (<>
                      {items.length > 0 && (
                        <p className="text-base font-bold text-foreground leading-snug mt-0.5">{auditItemLabel(items, productOf)}</p>
                      )}
                      <p className="text-sm text-[#A4A7B5] leading-snug mt-0.5">{desc}</p>
                    </>);
                  })()}
                  {entry.reason && <span className="text-xs text-[#7B7F93] capitalize">Reason: {entry.reason.replace('_', ' ')}</span>}
                </div>
                <span className="text-xs text-[#7B7F93] flex-shrink-0">{formatTime(entry.timestamp)}</span>
              </div>
              {entry.actorName && <p className="text-xs text-[#7B7F93] mt-0.5">by {entry.actorName}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
