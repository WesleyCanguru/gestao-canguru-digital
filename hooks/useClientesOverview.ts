
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Client, ClientQuickLink, PostData } from '../types';
import dayjs from 'dayjs';

export function useClientesOverview() {
  const [clients, setClients] = useState<Client[]>([]);
  const [quickLinks, setQuickLinks] = useState<ClientQuickLink[]>([]);
  const [stats, setStats] = useState<Record<string, { publishedToday: number, nextPublication: string | null, totalPublishedMonth: number }>>({});
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch Clients
      const { data: clientsData } = await supabase
        .from('clients')
        .select('*')
        .eq('is_active', true)
        .order('name');

      const clientList = (clientsData || []) as Client[];
      setClients(clientList);

      // Fetch Quick Links
      const { data: linksData } = await supabase
        .from('client_quick_links')
        .select('*');

      setQuickLinks((linksData || []) as ClientQuickLink[]);

      // Fetch Editorial Posts for stats
      const today = dayjs().format('YYYY-MM-DD');
      const startOfMonth = dayjs().startOf('month').format('YYYY-MM-DD');
      const endOfMonth = dayjs().endOf('month').format('YYYY-MM-DD');

      const { data: postsData } = await supabase
        .from('editorial_posts')
        .select('*')
        .gte('scheduled_date', startOfMonth)
        .lte('scheduled_date', endOfMonth);

      const posts = (postsData || []) as any[];

      const statsMap: Record<string, { publishedToday: number, nextPublication: string | null, totalPublishedMonth: number }> = {};

      clientList.forEach(client => {
        const clientPosts = posts.filter(p => p.client_id === client.id);
        
        const publishedToday = clientPosts.filter(p => p.status === 'published' && p.scheduled_date === today).length;
        
        const totalPublishedMonth = clientPosts.filter(p => p.status === 'published').length;
        
        const nextPost = clientPosts
          .filter(p => (p.status === 'scheduled' || p.status === 'approved') && p.scheduled_date >= today)
          .sort((a, b) => dayjs(a.scheduled_date).diff(dayjs(b.scheduled_date)))[0];

        statsMap[client.id] = {
          publishedToday,
          totalPublishedMonth,
          nextPublication: nextPost ? nextPost.scheduled_date : null
        };
      });

      setStats(statsMap);
    } catch (error) {
      console.error('Error fetching clients overview data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const addQuickLink = async (link: Omit<ClientQuickLink, 'id' | 'created_at'>) => {
    try {
      const { data, error } = await supabase
        .from('client_quick_links')
        .insert([link])
        .select()
        .single();

      if (error) throw error;
      setQuickLinks(prev => [...prev, data]);
      return data;
    } catch (error) {
      console.error('Error adding quick link:', error);
      throw error;
    }
  };

  const deleteQuickLink = async (id: string) => {
    try {
      const { error } = await supabase
        .from('client_quick_links')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setQuickLinks(prev => prev.filter(l => l.id !== id));
    } catch (error) {
      console.error('Error deleting quick link:', error);
      throw error;
    }
  };

  return {
    clients,
    quickLinks,
    stats,
    loading,
    addQuickLink,
    deleteQuickLink,
    refresh: fetchData
  };
}
