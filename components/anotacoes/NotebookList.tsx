import React, { useEffect, useState } from 'react';
import { Notebook } from '../../hooks/useNotebooks';
import { Plus, PanelLeftClose, PanelLeft } from 'lucide-react';
import { supabase, useAuth } from '../../lib/supabase';

interface NotebookListProps {
  notebooks: Notebook[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
}

export function NotebookList({ notebooks, selectedId, onSelect, onCreate }: NotebookListProps) {
  const { agencyId } = useAuth();
  const [counts, setCounts] = useState<Record<string, number>>({});
  
  // Persisted collapse state (defaults to false)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('anotacoes_sidebar_collapsed') === 'true';
    }
    return false;
  });

  const toggleCollapse = () => {
    const nextState = !isCollapsed;
    setIsCollapsed(nextState);
    localStorage.setItem('anotacoes_sidebar_collapsed', String(nextState));
  };

  useEffect(() => {
    if (agencyId) {
      const fetchCounts = async () => {
        const { data, error } = await supabase
          .from('notes')
          .select('notebook_id')
          .eq('agency_id', agencyId);
        
        if (data && !error) {
          const newCounts: Record<string, number> = {};
          data.forEach((note: any) => {
            if (note.notebook_id) {
              newCounts[note.notebook_id] = (newCounts[note.notebook_id] || 0) + 1;
            }
          });
          setCounts(newCounts);
        }
      };
      
      fetchCounts();

      // Realtime subscription to notes table for real-time automatic client-side updates
      const channel = supabase
        .channel('notes_count_realtime_changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'notes', filter: `agency_id=eq.${agencyId}` },
          () => {
            fetchCounts();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [notebooks, agencyId]);

  return (
    <div className={`w-full ${isCollapsed ? 'sm:w-[72px]' : 'sm:w-64'} bg-gray-50/50 border-r border-gray-100 flex flex-col h-full shrink-0 transition-all duration-300`}>
      <div className={`p-6 border-b border-gray-100 flex items-center ${isCollapsed ? 'justify-center gap-0 px-2' : 'justify-between'}`}>
        {!isCollapsed && <h2 className="text-lg font-bold text-brand-dark truncate">Cadernos</h2>}
        <div className="flex items-center gap-1.5 shrink-0">
          {!isCollapsed && (
            <button onClick={onCreate} className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors text-gray-500" title="Criar Caderno">
              <Plus size={16} />
            </button>
          )}
          <button 
            type="button"
            onClick={toggleCollapse} 
            className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors text-gray-500" 
            title={isCollapsed ? "Expandir Menu" : "Recolher Menu"}
          >
            {isCollapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-2">
        {notebooks.map(nb => (
          <div key={nb.id} className="relative group/nb">
            <button
              onClick={() => onSelect(nb.id)}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center p-2' : 'gap-3 px-3 py-2.5'} rounded-xl transition-all text-left ${selectedId === nb.id ? 'bg-white shadow-sm border border-gray-100 font-semibold' : 'hover:bg-gray-100 border border-transparent text-gray-600'}`}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${nb.color}20`, color: nb.color }}>
                <span className="text-sm">{nb.emoji || '📔'}</span>
              </div>
              {!isCollapsed && (
                <>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-700 block truncate">{nb.title}</span>
                  </div>
                  <span className="text-xs text-gray-400 font-medium shrink-0">{counts[nb.id] || 0}</span>
                </>
              )}
            </button>

            {/* Premium Absolute hover tooltip with count details */}
            {isCollapsed && (
              <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover/nb:opacity-100 pointer-events-none transition-all duration-150 shadow-md z-50">
                {nb.title} ({counts[nb.id] || 0})
              </div>
            )}
          </div>
        ))}
        {isCollapsed && (
          <div className="pt-2 border-t border-gray-100 flex justify-center">
            <button key="collapsed-add" onClick={onCreate} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 text-gray-400 border border-dashed border-gray-200" title="Criar Caderno">
              <Plus size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

