/**
 * DangerZone — destructive settings actions
 * Design: "Neon Ledger" — red-bordered section, two-step confirm per action
 * Actions: Reset Stock, Delete Products, Delete Project, Full Reset, Remove Mock Data
 */

import { useState } from 'react';
import { AlertTriangle, RefreshCw, Trash2, FolderX, Bomb, Eraser, X, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import {
  resetAllStock,
  deleteAllProducts,
  deleteProjectData,
  resetAndDeleteAll,
  removeMockData,
} from '../lib/db';
import { cn } from '../lib/utils';

// ── Confirm Dialog ─────────────────────────────────────────────────────────

interface ConfirmDialogProps {
  action: DangerAction;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

function ConfirmDialog({ action, onConfirm, onClose }: ConfirmDialogProps) {
  const [typing, setTyping] = useState('');
  const [running, setRunning] = useState(false);
  const needsTyping = action.confirmWord != null;
  const canConfirm = !needsTyping || typing.trim().toUpperCase() === action.confirmWord?.toUpperCase();

  async function handleConfirm() {
    if (!canConfirm) return;
    setRunning(true);
    try {
      await onConfirm();
      toast.success(action.successMsg);
      onClose();
      if (action.reload) {
        setTimeout(() => window.location.reload(), 800);
      }
    } catch (e) {
      toast.error('Operation failed — check console');
      console.error(e);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(14,15,20,0.95)', backdropFilter: 'blur(10px)' }}>
      <div className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl animate-slide-up"
        style={{ background: '#141624', border: `1px solid ${action.color}40` }}>

        {/* Header */}
        <div className="flex items-start justify-between p-5 pb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: `${action.color}15` }}>
              <action.icon size={18} style={{ color: action.color }} />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#E6E7EB]">{action.label}</h2>
              <p className="text-xs text-[#7B7F93] mt-0.5 leading-relaxed">{action.description}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#7B7F93] hover:text-[#E6E7EB] p-1 flex-shrink-0">
            <X size={16} />
          </button>
        </div>

        {/* Warning box */}
        <div className="mx-5 mb-4 rounded-xl px-3 py-2.5"
          style={{ background: `${action.color}08`, border: `1px solid ${action.color}25` }}>
          <div className="flex items-start gap-2">
            <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" style={{ color: action.color }} />
            <p className="text-xs leading-relaxed" style={{ color: action.color }}>
              {action.warning}
            </p>
          </div>
        </div>

        {/* Type-to-confirm */}
        {needsTyping && (
          <div className="px-5 mb-4">
            <p className="text-xs text-[#7B7F93] mb-2">
              Type <span className="font-bold text-[#E6E7EB]">{action.confirmWord}</span> to confirm
            </p>
            <input
              value={typing}
              onChange={e => setTyping(e.target.value)}
              placeholder={action.confirmWord}
              autoFocus
              className="w-full px-3 py-2 rounded-lg text-sm font-bold text-[#E6E7EB] bg-[#0E0F14] focus:outline-none tracking-widest uppercase"
              style={{ border: `1px solid ${canConfirm && typing ? action.color + '60' : '#2D3048'}` }}
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-[#A4A7B5]"
            style={{ border: '1px solid #2D3048' }}>
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm || running}
            className={cn(
              'flex-[2] py-3 rounded-xl text-sm font-black text-white flex items-center justify-center gap-2 transition-all',
              !canConfirm || running ? 'opacity-40 cursor-not-allowed' : 'active:scale-98'
            )}
            style={{ background: `linear-gradient(135deg, ${action.color} 0%, ${action.color}99 100%)` }}>
            {running
              ? <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              : <><action.icon size={14} /> {action.ctaLabel}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Action definitions ─────────────────────────────────────────────────────

interface DangerAction {
  id: string;
  label: string;
  description: string;
  warning: string;
  ctaLabel: string;
  successMsg: string;
  icon: React.ElementType;
  color: string;
  confirmWord?: string;
  reload?: boolean;
  fn: () => Promise<void>;
}

const DANGER_ACTIONS: DangerAction[] = [
  {
    id: 'remove-mock',
    label: 'Remove Mock Data',
    description: 'Deletes the pre-loaded demo products and shows (T-Shirt, Poster, Vinyl, etc.).',
    warning: 'Only demo data is removed. Your real products and shows are kept.',
    ctaLabel: 'Remove Mock Data',
    successMsg: 'Mock data removed',
    icon: Eraser,
    color: '#FBBF24',
    fn: removeMockData,
  },
  {
    id: 'reset-stock',
    label: 'Reset All Stock',
    description: 'Resets every variant\'s current stock back to its initial stock value.',
    warning: 'All stock counts will be restored to their starting values. Sale history is kept.',
    ctaLabel: 'Reset Stock',
    successMsg: 'All stock reset to initial values',
    icon: RefreshCw,
    color: '#FBBF24',
    confirmWord: 'RESET',
    fn: resetAllStock,
  },
  {
    id: 'delete-products',
    label: 'Delete All Products',
    description: 'Permanently removes every product and all their variants from this device.',
    warning: 'This cannot be undone. All products and variants will be permanently deleted.',
    ctaLabel: 'Delete All Products',
    successMsg: 'All products deleted',
    icon: Trash2,
    color: '#F87171',
    confirmWord: 'DELETE',
    fn: deleteAllProducts,
  },
  {
    id: 'delete-project',
    label: 'Delete Project & Data',
    description: 'Wipes all products, shows, sessions, sales, audit log, and sync queue for this project.',
    warning: 'All project data will be permanently erased from this device. This cannot be undone.',
    ctaLabel: 'Delete Project',
    successMsg: 'Project data deleted',
    icon: FolderX,
    color: '#F87171',
    confirmWord: 'DELETE',
    fn: deleteProjectData,
  },
  {
    id: 'full-reset',
    label: 'Reset & Delete All',
    description: 'Full factory reset. Wipes every store, all settings, device ID, and all projects. The app will reload.',
    warning: 'IRREVERSIBLE. Every byte of MerchPad data on this device will be permanently destroyed.',
    ctaLabel: 'Factory Reset',
    successMsg: 'Factory reset complete — reloading…',
    icon: Bomb,
    color: '#C026D3',
    confirmWord: 'DESTROY',
    reload: true,
    fn: resetAndDeleteAll,
  },
];

// ── Main Component ─────────────────────────────────────────────────────────

export default function DangerZone() {
  const [activeAction, setActiveAction] = useState<DangerAction | null>(null);

  return (
    <>
      <div className="rounded-2xl overflow-hidden"
        style={{ border: '1px solid rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.03)' }}>

        {/* Header */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b"
          style={{ borderColor: 'rgba(248,113,113,0.2)', background: 'rgba(248,113,113,0.06)' }}>
          <AlertTriangle size={15} className="text-[#F87171]" />
          <span className="text-sm font-black text-[#F87171] uppercase tracking-wider">Danger Zone</span>
        </div>

        {/* Action list */}
        <div className="divide-y" style={{ borderColor: 'rgba(248,113,113,0.1)' }}>
          {DANGER_ACTIONS.map((action) => (
            <button
              key={action.id}
              onClick={() => setActiveAction(action)}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all hover:bg-[rgba(248,113,113,0.04)] group">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: `${action.color}12` }}>
                <action.icon size={15} style={{ color: action.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#E6E7EB]">{action.label}</p>
                <p className="text-xs text-[#7B7F93] truncate">{action.description}</p>
              </div>
              <ChevronRight size={14} className="text-[#7B7F93] flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
        </div>
      </div>

      {/* Confirm dialog */}
      {activeAction && (
        <ConfirmDialog
          action={activeAction}
          onConfirm={activeAction.fn}
          onClose={() => setActiveAction(null)}
        />
      )}
    </>
  );
}
