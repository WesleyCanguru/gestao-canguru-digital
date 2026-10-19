import React from 'react';
import { Eye, X } from 'lucide-react';
import { useAuth } from '../lib/supabase';

export const ViewAsClientBanner: React.FC = () => {
  const { activeClient, exitViewAsClient, isViewingAsClient } = useAuth();
  if (!isViewingAsClient || !activeClient) return null;
  return (
    <div className="fixed top-0 inset-x-0 z-[200] h-11 bg-amber-400 text-amber-950 flex items-center justify-center gap-3 px-4 text-xs sm:text-sm font-bold shadow-md">
      <Eye size={16} className="shrink-0" />
      <span className="truncate">
        Visualizando como <span className="underline decoration-2 underline-offset-2">{activeClient.name}</span>
        <span className="hidden sm:inline font-medium"> · somente leitura, nada é salvo</span>
      </span>
      <button
        onClick={exitViewAsClient}
        className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-950 text-amber-50 px-3 py-1 text-[11px] font-bold hover:bg-black transition-colors shrink-0"
      >
        <X size={12} /> Sair
      </button>
    </div>
  );
};
