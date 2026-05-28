import React, { useState, useEffect } from 'react';
import { useNotebooks } from '../../hooks/useNotebooks';
import { useNotes, Note } from '../../hooks/useNotes';
import { NotebookList } from '../anotacoes/NotebookList';
import { NoteList } from '../anotacoes/NoteList';
import { NoteEditor } from '../anotacoes/NoteEditor';
import { ChevronLeft } from 'lucide-react';

type MobileView = 'notebooks' | 'notes' | 'editor';

export function AnotacoesTab() {
  const { notebooks, loading: notebooksLoading, createNotebook, deleteNotebook, renameNotebook } = useNotebooks();
  
  const [selectedNotebookId, setSelectedNotebookId] = useState<string | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<MobileView>('notebooks');

  const { notes, loading: notesLoading, createNote, updateNote, deleteNote } = useNotes(selectedNotebookId);

  // Auto-select first notebook if none selected
  useEffect(() => {
    if (notebooks.length > 0 && !selectedNotebookId) {
      // Pick Geral or default or first
      const defaultNb = notebooks.find(n => n.is_default) || notebooks.find(n => n.title === 'Geral') || notebooks[0];
      setSelectedNotebookId(defaultNb.id);
    }
  }, [notebooks, selectedNotebookId]);

  const selectedNotebook = notebooks.find(n => n.id === selectedNotebookId) || null;
  const selectedNote = notes.find(n => n.id === selectedNoteId) || null;

  const handleSelectNotebook = (id: string) => {
    setSelectedNotebookId(id);
    setSelectedNoteId(null);
    setMobileView('notes');
  };

  const handleSelectNote = (id: string) => {
    setSelectedNoteId(id);
    setMobileView('editor');
  };

  const handleCreateNote = async () => {
    const note = await createNote();
    if (note) {
      setSelectedNoteId(note.id);
      setMobileView('editor');
    }
  };

  const handleCreateNotebook = async () => {
    const name = window.prompt('Qual o nome do novo caderno?');
    if (!name) return;
    const emojis = ['📓', '📘', '📗', '📔', '📙', '📋', '📁'];
    const emoji = emojis[Math.floor(Math.random() * emojis.length)];
    const nb = await createNotebook(name.trim(), emoji, '#3B82F6');
    if (nb) {
      handleSelectNotebook(nb.id);
    }
  };

  return (
    <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col md:flex-row absolute inset-0">
      
      {/* Mobile headers for back navigation */}
      <div className="md:hidden flex shrink-0 border-b border-gray-100 p-4 bg-white/50 backdrop-blur-sm z-20">
        {mobileView === 'notes' && (
          <button onClick={() => setMobileView('notebooks')} className="flex items-center text-brand-dark font-medium">
            <ChevronLeft size={20} /> Cadernos
          </button>
        )}
        {mobileView === 'editor' && (
          <button onClick={() => setMobileView('notes')} className="flex items-center text-brand-dark font-medium">
            <ChevronLeft size={20} /> Notas
          </button>
        )}
        {mobileView === 'notebooks' && (
          <h2 className="font-bold text-brand-dark px-2">Anotações</h2>
        )}
      </div>

      <div className={`h-full ${mobileView === 'notebooks' ? 'block w-full' : 'hidden md:block'} shrink-0`}>
        <NotebookList 
          notebooks={notebooks} 
          selectedId={selectedNotebookId} 
          onSelect={handleSelectNotebook}
          onCreate={handleCreateNotebook}
          onRename={renameNotebook}
          onDelete={async (id) => {
            const confirmedValue = window.confirm(`Tem certeza que deseja excluir o caderno? Todas as notas dentro dele também serão excluídas permanentemente.`);
            if (!confirmedValue) return false;
            const success = await deleteNotebook(id);
            if (success) {
              if (selectedNotebookId === id) {
                const remaining = notebooks.filter(n => n.id !== id);
                if (remaining.length > 0) {
                  const defaultNb = remaining.find(n => n.is_default) || remaining.find(n => n.title === 'Geral') || remaining[0];
                  setSelectedNotebookId(defaultNb.id);
                } else {
                  setSelectedNotebookId(null);
                }
              }
            }
            return success;
          }}
        />
      </div>

      <div className={`h-full ${mobileView === 'notes' ? 'block w-full md:w-80' : 'hidden md:block'} shrink-0`}>
        <NoteList 
          notebook={selectedNotebook}
          notes={notes}
          selectedId={selectedNoteId}
          onSelect={handleSelectNote}
          onCreate={handleCreateNote}
          onDeleteNote={async (id) => {
            await deleteNote(id);
            if (selectedNoteId === id) {
              setSelectedNoteId(null);
            }
          }}
        />
      </div>

      <div className={`h-full flex-1 flex flex-col min-w-0 ${mobileView === 'editor' ? 'flex w-full md:w-auto md:flex-1' : 'hidden md:block'}`}>
        <NoteEditor 
          note={selectedNote}
          onUpdate={updateNote}
        />
      </div>
      
    </div>
  );
}
