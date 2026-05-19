
import { useState, useEffect } from 'react';
import { supabase, useAuth } from '../lib/supabase';
import { Client, ClientQuickLink, PostData } from '../types';
import dayjs from 'dayjs';

export function useClientesOverview() {
  const { agencyId } = useAuth();
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
        .eq('agency_id', agencyId)
        .eq('is_active', true)
        .order('name');

      const clientList = (clientsData || []) as Client[];
      setClients(clientList);

      // Fetch Quick Links
      const { data: linksData } = await supabase
        .from('client_quick_links')
        .select('*')
        .eq('agency_id', agencyId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      setQuickLinks((linksData || []) as ClientQuickLink[]);

      // Fetch Posts for stats
      const todayStr = dayjs().format('DD-MM-YYYY');
      const currentMonthStr = dayjs().format('MM-YYYY');

      const { data: postsData } = await supabase
        .from('posts')
        .select('*')
        .eq('agency_id', agencyId);

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
  }, [agencyId]);

  const addQuickLink = async (link: Omit<ClientQuickLink, 'id' | 'created_at'>) => {
    try {
      const { data, error } = await supabase
        .from('client_quick_links')
        .insert([{ ...link, agency_id: agencyId }])
        .select()
        .single();

      if (error) throw error;
      
      setQuickLinks(prev => [...prev, data]);
      return data;
    } catch (error) {
      console.error('Erro ao adicionar link:', error);
      throw error;
    }
  };

  const deleteQuickLink = async (id: string) => {
    try {
      const { error } = await supabase
        .from('client_quick_links')
        .delete()
        .eq('agency_id', agencyId)
        .eq('id', id);

      if (error) throw error;
      setQuickLinks(prev => prev.filter(l => l.id !== id));
    } catch (error) {
      console.error('Error deleting quick link:', error);
      throw error;
    }
  };

  const updateQuickLink = async (id: string, updates: Partial<ClientQuickLink>) => {
    try {
      const { data, error } = await supabase
        .from('client_quick_links')
        .update(updates)
        .eq('agency_id', agencyId)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      setQuickLinks(prev => prev.map(l => (l.id === id ? data : l)));
    } catch (error) {
      console.error('Error updating quick link:', error);
      throw error;
    }
  };

  const reorderQuickLinks = async (client_id: string, orderedIds: string[]) => {
    try {
      // Optistic update
      setQuickLinks(prev => {
        const otherLinks = prev.filter(l => l.client_id !== client_id);
        const thisClientLinks = prev.filter(l => l.client_id === client_id);
        
        const sortedLinks = [...thisClientLinks].sort((a, b) => {
          return orderedIds.indexOf(a.id) - orderedIds.indexOf(b.id);
        });

        // Add sort_order field temporarily
        sortedLinks.forEach((l, i) => l.sort_order = i);
        return [...otherLinks, ...sortedLinks];
      });

      const promises = orderedIds.map((id, index) => 
        supabase.from('client_quick_links').update({ sort_order: index }).eq('agency_id', agencyId).eq('id', id)
      );

      await Promise.all(promises);
    } catch (err) {
      console.error('Error reordering links:', err);
      fetchData(); // re-fetch to restore state if error
    }
  };

  return {
    clients,
    quickLinks,
    stats,
    loading,
    addQuickLink,
    deleteQuickLink,
    updateQuickLink,
    reorderQuickLinks,
    refresh: fetchData
  };
}
