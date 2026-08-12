import { useState, useEffect } from 'react';
import { supabase, useAuth } from '../lib/supabase';

export interface Note {
  id: string;
  notebook_id: string;
  agency_id: string;
  title: string;
  content: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export function useNotes(notebookId: string | null) {
  const { agencyId } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (agencyId && notebookId) {
      fetchNotes();
    } else {
      setNotes([]);
    }
  }, [agencyId, notebookId]);

  const fetchNotes = async () => {
    if (!notebookId || !agencyId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('notebook_id', notebookId)
        .eq('agency_id', agencyId)
        .order('is_pinned', { ascending: false })
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      setNotes(data || []);
    } catch (err) {
      console.error('Error fetching notes', err);
    } finally {
      setLoading(false);
    }
  };

  const createNote = async (initialTitle: string = 'Sem título') => {
    if (!notebookId || !agencyId) return null;
    try {
      const { data, error } = await supabase
        .from('notes')
        .insert([{ 
          notebook_id: notebookId, 
          agency_id: agencyId, 
          title: initialTitle, 
          content: '',
          is_pinned: false
        }])
        .select()
        .single();
      
      if (error) throw error;
      setNotes([data, ...notes]);
      return data;
    } catch (err) {
      console.error('Error creating note', err);
      return null;
    }
  };

  const updateNote = async (id: string, updates: Partial<Note>) => {
    try {
      setNotes(current => {
        if (updates.notebook_id && updates.notebook_id !== notebookId) {
          return current.filter(n => n.id !== id);
        }
        return current.map(n => n.id === id ? { ...n, ...updates, updated_at: new Date().toISOString() } : n);
      });
      const { error } = await supabase
        .from('notes')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('agency_id', agencyId);
      
      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Error updating note', err);
      return false;
    }
  };
  
  const deleteNote = async (id: string) => {
    try {
      setNotes(current => current.filter(n => n.id !== id));
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', id)
        .eq('agency_id', agencyId);
      if (error) throw error;
    } catch (err) {
      console.error('Error deleting note', err);
    }
  };

  return { notes, loading, fetchNotes, createNote, updateNote, deleteNote };
}
