/**
 * RightDrawer — reusable right-side drawer
 * Design: Neon Ledger dark theme
 *
 * Fixed to the viewport (not affected by page scroll).
 * Slides in from the right. Dark overlay on the left.
 * X button at top-right of panel.
 */

import { useEffect, ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';

interface RightDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Extra classes for the drawer panel (e.g. custom width) */
  className?: string;
}

export function RightDrawer({ open, onClose, title, subtitle, children, className }: RightDrawerProps) {
  // Lock body scroll while drawer is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" aria-modal="true" role="dialog">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(14,15,20,0.75)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        className={cn(
          'relative flex flex-col w-full max-w-sm h-full overflow-hidden',
          'animate-slide-in-right',
          className
        )}
        style={{ background: '#141624', borderLeft: '1px solid #2D3048' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-4 border-b border-[#24273A] flex-shrink-0"
          style={{ background: '#141624' }}
        >
          <div className="min-w-0 flex-1 pr-3">
            <h2 className="text-base font-bold text-[#E6E7EB] truncate">{title}</h2>
            {subtitle && <p className="text-xs text-[#7B7F93] truncate mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 p-1.5 rounded-lg text-[#7B7F93] hover:text-[#E6E7EB] hover:bg-[#1B1E2E] transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>
    </div>
  );
}
