
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Client, ClientQuickLink, PostData } from '../types';
import dayjs from 'dayjs';

export function useClientesOverview() {
  const [clients, setClients] = useState<Client[]>([]);
  const [quickLinks, setQuickLinks] = useState<ClientQuickLink[]>([]);
  const [stats, setStats] = useState<Record<string, { publishedToday: number, nextPublication: string | null, totalPublishedMonth: number, changesRequested: number, pendingApproval: number, drafts: number }>>({});
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

      // Fetch Posts for stats
      const todayStr = dayjs().format('DD-MM-YYYY');
      const currentMonthStr = dayjs().format('MM-YYYY');

      const { data: postsData } = await supabase
        .from('posts')
        .select('*');

      const posts = (postsData || []) as PostData[];

      const statsMap: Record<string, { publishedToday: number, nextPublication: string | null, totalPublishedMonth: number, changesRequested: number, pendingApproval: number, drafts: number }> = {};

      clientList.forEach(client => {
        const clientPosts = posts.filter(p => p.client_id === client.id && p.status !== 'deleted');
        
        // Agrupar posts por data e tema para não duplicar a contagem (ex: Meta e LinkedIn no mesmo dia)
        const groupedPostsMap = new Map<string, any>();
        
        clientPosts.forEach(p => {
          const parts = p.date_key.split('-'); // DD-MM-YYYY-platform-clientId
          const dateStr = parts.length >= 3 ? `${parts[0]}-${parts[1]}-${parts[2]}` : p.date_key;
          const theme = p.theme || 'Sem tema definido';
          const groupKey = `${dateStr}-${theme}`;
          
          if (!groupedPostsMap.has(groupKey)) {
            groupedPostsMap.set(groupKey, {
              ...p,
              groupStatus: p.status,
              dateStr: dateStr
            });
          } else {
            const existing = groupedPostsMap.get(groupKey);
            const s1 = existing.groupStatus;
            const s2 = p.status;
            
            // Hierarquia de status: changes_requested > pending_approval > draft > scheduled > approved > published
            const hierarchy = ['changes_requested', 'pending_approval', 'draft', 'scheduled', 'approved', 'published'];
            const i1 = hierarchy.indexOf(s1);
            const i2 = hierarchy.indexOf(s2);
            
            // Se o status atual (s2) for mais prioritário (menor índice) que o existente (s1), atualiza
            if (i2 !== -1 && (i1 === -1 || i2 < i1)) {
              existing.groupStatus = s2;
            }
          }
        });

        const groupedPosts = Array.from(groupedPostsMap.values());
        
        const publishedToday = groupedPosts.filter(p => p.groupStatus === 'published' && p.dateStr === todayStr).length;
        
        const totalPublishedMonth = groupedPosts.filter(p => p.groupStatus === 'published' && p.dateStr.includes(currentMonthStr)).length;
        
        const changesRequested = groupedPosts.filter(p => p.groupStatus === 'changes_requested' && p.dateStr.includes(currentMonthStr)).length;
        
        const pendingApproval = groupedPosts.filter(p => p.groupStatus === 'pending_approval' && p.dateStr.includes(currentMonthStr)).length;

        const drafts = groupedPosts.filter(p => p.groupStatus === 'draft' && p.dateStr.includes(currentMonthStr)).length;

        const nextPost = groupedPosts
          .filter(p => (p.groupStatus === 'scheduled' || p.groupStatus === 'approved'))
          .map(p => {
            const parts = p.dateStr.split('-');
            if (parts.length >= 3) {
              const isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
              return { ...p, sortDate: dayjs(isoDate).valueOf(), isoDate };
            }
            return { ...p, sortDate: 0, isoDate: '' };
          })
          .filter(p => p.sortDate >= dayjs().startOf('day').valueOf())
          .sort((a, b) => a.sortDate - b.sortDate)[0];

        statsMap[client.id] = {
          publishedToday,
          totalPublishedMonth,
          changesRequested,
          pendingApproval,
          drafts,
          nextPublication: nextPost ? nextPost.isoDate : null
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
      console.log('DADOS SENDO ENVIADOS:', JSON.stringify(link, null, 2));
      const { data, error } = await supabase
        .from('client_quick_links')
        .insert([link])
        .select()
        .single();

      if (error) {
        console.error('ERRO SUPABASE (DETALHADO):', JSON.stringify(error, null, 2));
        throw error;
      }
      
      setQuickLinks(prev => [...prev, data]);
      return data;
    } catch (error) {
      console.error('ERRO AO ADICIONAR LINK:', error);
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
