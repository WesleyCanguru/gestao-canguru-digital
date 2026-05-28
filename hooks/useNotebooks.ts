import { useState, useEffect } from 'react';
import { supabase, useAuth } from '../lib/supabase';

export interface Notebook {
  id: string;
  agency_id: string;
  title: string;
  emoji: string;
  color: string;
  position: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export function useNotebooks() {
  const { agencyId } = useAuth();
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (agencyId) {
      fetchNotebooks();
    }
  }, [agencyId]);

  const fetchNotebooks = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('notebooks')
        .select('*')
        .eq('agency_id', agencyId)
        .order('position');
      
      if (error) throw error;
      setNotebooks(data || []);
    } catch (err) {
      console.error('Error fetching notebooks', err);
    } finally {
      setLoading(false);
    }
  };

  const createNotebook = async (title: string, emoji: string, color: string) => {
    if (!agencyId) return null;
    try {
      const position = notebooks.length > 0 ? Math.max(...notebooks.map(n => n.position)) + 1 : 0;
      const { data, error } = await supabase
        .from('notebooks')
        .insert([{ agency_id: agencyId, title, emoji, color, position, is_default: false }])
        .select()
        .single();
      
      if (error) throw error;
      setNotebooks([...notebooks, data]);
      return data;
    } catch (err) {
      console.error('Error creating notebook', err);
      return null;
    }
  };

  const deleteNotebook = async (id: string) => {
    if (!agencyId) return false;
    try {
      const { error: notesError } = await supabase
        .from('notes')
        .delete()
        .eq('notebook_id', id)
        .eq('agency_id', agencyId);
      
      if (notesError) throw notesError;

      const { error: notebookError } = await supabase
        .from('notebooks')
        .delete()
        .eq('id', id)
        .eq('agency_id', agencyId);

      if (notebookError) throw notebookError;

      setNotebooks(current => current.filter(n => n.id !== id));
      return true;
    } catch (err) {
      console.error('Error deleting notebook', err);
      return false;
    }
  };

  const renameNotebook = async (id: string, newTitle: string) => {
    if (!agencyId) return false;
    try {
      const { error } = await supabase
        .from('notebooks')
        .update({ title: newTitle, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('agency_id', agencyId);

      if (error) throw error;

      setNotebooks(current => current.map(n => n.id === id ? { ...n, title: newTitle, updated_at: new Date().toISOString() } : n));
      return true;
    } catch (err) {
      console.error('Error renaming notebook', err);
      return false;
    }
  };

  return { notebooks, loading, fetchNotebooks, createNotebook, deleteNotebook, renameNotebook };
}
