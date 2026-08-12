import React, { useState } from 'react';
import { Note } from '../../hooks/useNotes';
import { Notebook } from '../../hooks/useNotebooks';
import { Plus, Pin, Trash2, FolderInput } from 'lucide-react';
import dayjs from 'dayjs';

interface NoteListProps {
  notebook: Notebook | null;
  notebooks?: Notebook[];
  notes: Note[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDeleteNote?: (id: string) => void;
  onMoveNote?: (noteId: string, targetNotebookId: string) => void;
}

export function NoteList({ notebook, notebooks = [], notes, selectedId, onSelect, onCreate, onDeleteNote, onMoveNote }: NoteListProps) {
  const [movingNoteId, setMovingNoteId] = useState<string | null>(null);

  const extractPreview = (htmlStr: string) => {
    if (!htmlStr) return 'Sem conteúdo adicional';
    const tmp = document.createElement('div');
    tmp.innerHTML = htmlStr;
    const text = tmp.textContent || tmp.innerText || '';
    return text.substring(0, 80) + (text.length > 80 ? '...' : '');
  };

  return (
    <div className="w-full md:w-80 bg-white border-r border-gray-100 flex flex-col h-full shrink-0 overflow-hidden" onClick={() => setMovingNoteId(null)}>
      <div className="p-6 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-3 mb-4">
          {notebook ? (
            <>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${notebook.color}20`, color: notebook.color }}>
                <span className="text-xl">{notebook.emoji || '📔'}</span>
              </div>
              <h2 className="text-xl font-bold text-brand-dark truncate flex-1 text-left" style={{ textAlign: 'left' }}>{notebook.title}</h2>
            </>
          ) : (
            <h2 className="text-xl font-bold text-brand-dark text-left" style={{ textAlign: 'left' }}>Anotações</h2>
          )}
        </div>
        <button 
          onClick={onCreate}
          disabled={!notebook}
          className="w-full flex items-center justify-center gap-2 py-3 bg-brand-dark text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-brand-dark/90 transition-all disabled:opacity-50 active:scale-95"
        >
          <Plus size={16} /> Nova Nota
        </button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {notes.length === 0 ? (
          <div className="p-8 text-center bg-gray-50/30 h-full flex flex-col justify-center items-center">
            <span className="text-4xl mb-4 opacity-50">✍️</span>
            <p className="text-sm text-gray-500 font-medium text-left">Nenhuma nota encontrada.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50 w-full">
            {notes.map(note => (
              <div
                key={note.id}
                onClick={() => onSelect(note.id)}
                className={`w-full text-left p-5 transition-colors block relative group/note cursor-pointer ${selectedId === note.id ? 'bg-blue-50/50' : 'hover:bg-gray-50'}`}
                style={{ textAlign: 'left' }}
              >
                <div className="flex items-start justify-between gap-1 mb-1.5 w-full">
                  <h3 className="font-bold text-brand-dark text-sm truncate flex-1 min-w-0" style={{ textAlign: 'left' }}>
                    {note.title || 'Sem título'}
                  </h3>
                  <div className="flex items-center gap-1 shrink-0">
                    {note.is_pinned && <Pin size={13} className="text-brand-dark mt-0.5 shrink-0" />}
                    
                    {notebooks.length > 1 && onMoveNote && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMovingNoteId(movingNoteId === note.id ? null : note.id);
                        }}
                        className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-blue-600 transition-colors"
                        title="Mover para outro caderno"
                      >
                        <FolderInput size={14} />
                      </button>
                    )}

                    {onDeleteNote && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const confirmDelete = window.confirm("Tem certeza que deseja excluir esta nota? Esta ação não pode ser desfeita.");
                          if (confirmDelete) {
                            onDeleteNote(note.id);
                          }
                        }}
                        className="hidden group-hover/note:flex p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-red-500 transition-colors"
                        title="Excluir Nota"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Dropdown Mover para Caderno */}
                {movingNoteId === note.id && (
                  <div 
                    className="absolute right-4 top-10 z-30 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 p-2 space-y-1 text-left"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2 py-1 border-b border-gray-50 mb-1">
                      Mover nota para:
                    </div>
                    {notebooks.map(nb => (
                      <button
                        key={nb.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onMoveNote) onMoveNote(note.id, nb.id);
                          setMovingNoteId(null);
                        }}
                        disabled={nb.id === note.notebook_id}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                          nb.id === note.notebook_id 
                            ? 'bg-gray-50 text-gray-400 cursor-default' 
                            : 'hover:bg-blue-50 text-gray-700 hover:text-blue-600'
                        }`}
                      >
                        <span className="text-base">{nb.emoji || '📔'}</span>
                        <span className="truncate flex-1 text-left">{nb.title}</span>
                        {nb.id === note.notebook_id && <span className="text-[9px] font-bold text-gray-400 uppercase">(Atual)</span>}
                      </button>
                    ))}
                  </div>
                )}

                <p className="text-xs text-gray-500 line-clamp-2 mb-2 leading-relaxed text-left w-full overflow-hidden text-ellipsis" style={{ textAlign: 'left' }}>
                  {extractPreview(note.content)}
                </p>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest block text-left" style={{ textAlign: 'left' }}>
                  {dayjs(note.updated_at).format('DD MMM YYYY')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
