import React, { useEffect, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';

export interface RowAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  hidden?: boolean;
  dividerBefore?: boolean;
}

/** Menu "⋯" padrão da Bolsa para ações secundárias de uma linha. */
export const RowActionsMenu: React.FC<{ actions: RowAction[]; label?: string }> = ({ actions, label = 'Mais ações' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const visible = actions.filter(a => !a.hidden);
  if (visible.length === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="p-2.5 rounded-xl border border-gray-200 text-gray-500 hover:text-brand-dark hover:border-brand-dark/30 bg-white transition-colors"
        title={label}
        aria-label={label}
      >
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 py-2">
          {visible.map((a, i) => (
            <React.Fragment key={a.label}>
              {a.dividerBefore && i > 0 && <div className="my-1.5 border-t border-gray-100" />}
              <button
                type="button"
                onClick={() => { setOpen(false); a.onClick(); }}
                className={`w-full px-4 py-2.5 flex items-center gap-3 text-left text-sm font-medium transition-colors ${
                  a.danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {a.icon && <span className="shrink-0 opacity-80">{a.icon}</span>}
                {a.label}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};
