
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Client, PostData } from '../../types';
import { 
  Building2, 
  Instagram, 
  ChevronRight,
  Globe,
  Settings,
  Calendar,
  CheckCircle2,
  Layout,
  ExternalLink,
  MessageSquare,
  TrendingUp,
  BarChart2,
  Monitor
} from 'lucide-react';
import { motion } from 'motion/react';
import dayjs from 'dayjs';
import { QuickLinksEditorModal, ClientQuickLink } from './QuickLinksEditorModal';

interface ActiveClientsSummaryProps {
  onSelectClient: (client: Client) => void;
}

interface ClientStats {
  today: number;
  monthTotal: number;
  inRevision: number;
  inApproval: number;
  drafts: number;
  nextDate: string | null;
}

export const ActiveClientsSummary: React.FC<ActiveClientsSummaryProps> = ({ onSelectClient }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [clientStats, setClientStats] = useState<Record<string, ClientStats>>({});
  const [quickLinks, setQuickLinks] = useState<Record<string, ClientQuickLink[]>>({});
  const [loading, setLoading] = useState(true);
  const [editingQuickLinksClient, setEditingQuickLinksClient] = useState<Client | null>(null);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    
    // 1. Fetch Active Clients
    const { data: clientsData } = await supabase
      .from('clients')
      .select('*')
      .eq('is_active', true)
      .order('name');
    
    if (!clientsData) {
      setLoading(false);
      return;
    }

    setClients(clientsData as Client[]);

    // 2. Fetch Posts for all active clients to calculate stats
    const { data: postsData } = await supabase
      .from('posts')
      .select('*')
      .in('client_id', clientsData.map(c => c.id));

    // 3. Fetch Quick Links
    const { data: linksData } = await supabase
      .from('client_quick_links')
      .select('*')
      .in('client_id', clientsData.map(c => c.id))
      .order('sort_order');

    const linksMap: Record<string, ClientQuickLink[]> = {};
    if (linksData) {
      linksData.forEach(link => {
        if (!linksMap[link.client_id]) linksMap[link.client_id] = [];
        linksMap[link.client_id].push(link as ClientQuickLink);
      });
    }
    setQuickLinks(linksMap);

    const stats: Record<string, ClientStats> = {};
    const today = dayjs().format('DD-MM-YYYY');
    const currentMonth = dayjs().format('MM-YYYY');

    const getUniquePosts = (posts: typeof postsData) => {
      if (!posts) return [];
      const unique = new Map();
      posts.forEach(p => {
        const parts = p.date_key.split('-');
        const datePrefix = parts.length >= 3 ? parts.slice(0, 3).join('-') : p.date_key;
        const themeStr = p.theme ? p.theme.trim() : '';
        const key = themeStr ? `${datePrefix}_${themeStr}` : p.date_key; // Se n\u00e3o tiver tema, mant\u00e9m isolado

        if (!unique.has(key)) {
          unique.set(key, p);
        } else {
          const existing = unique.get(key);
          const priority: Record<string, number> = {
            'changes_requested': 5,
            'pending_approval': 4,
            'draft': 3,
            'scheduled': 2,
            'approved': 1,
            'published': 0,
            'deleted': -1,
          };
          if ((priority[p.status] || 0) > (priority[existing.status] || 0)) {
            unique.set(key, p);
          }
        }
      });
      return Array.from(unique.values());
    };

    clientsData.forEach(client => {
      const clientPosts = (postsData || []).filter(p => p.client_id === client.id);
      const uniqueClientPosts = getUniquePosts(clientPosts);
      
      // Basic filter: exclude deleted, test entries or old posts if not in current month
      const monthPosts = uniqueClientPosts.filter(p => {
        if (p.status === 'deleted' || p.date_key === 'test_rls') return false;
        const parts = p.date_key.split('-');
        if (parts.length < 3) return false;
        const postMonthYear = `${parts[1]}-${parts[2]}`;
        return postMonthYear === currentMonth;
      });

      // Statistics strictly scoped to current month
      const todayPosts = monthPosts.filter(p => p.date_key.startsWith(today) && (p.status === 'published' || p.status === 'scheduled' || p.status === 'approved'));
      const inRevision = monthPosts.filter(p => p.status === 'changes_requested');
      const inApproval = monthPosts.filter(p => p.status === 'pending_approval');
      const drafts = monthPosts.filter(p => p.status === 'draft');
      
      // monthTotal is every post planned for the month
      const monthTotal = monthPosts.length;

      // Next scheduled (can look beyond current month if needed, but for dashboard context, current month is usually enough)
      // Actually, let's keep it looking at ALL future valid posts for accuracy on "what's next"
      const futurePosts = uniqueClientPosts
        .filter(p => {
           if (p.status === 'deleted' || p.date_key === 'test_rls') return false;
           const parts = p.date_key.split('-');
           if (parts.length < 3) return false;
           const postDateStr = `${parts[2]}-${parts[1]}-${parts[0]}`; // YYYY-MM-DD
           return dayjs(postDateStr).isAfter(dayjs().subtract(1, 'day')) && (p.status === 'scheduled' || p.status === 'approved');
        })
        .sort((a, b) => {
           const partsA = a.date_key.split('-');
           const partsB = b.date_key.split('-');
           const dateA = `${partsA[2]}-${partsA[1]}-${partsA[0]}`;
           const dateB = `${partsB[2]}-${partsB[1]}-${partsB[0]}`;
           return dayjs(dateA).unix() - dayjs(dateB).unix();
        });

      let nextDate = null;
      if (futurePosts.length > 0) {
        const firstFuture = futurePosts[0];
        const parts = firstFuture.date_key.split('-');
        nextDate = `${parts[0]}/${parts[1]}`;
      }

      stats[client.id] = {
        today: todayPosts.length,
        monthTotal,
        inRevision: inRevision.length,
        inApproval: inApproval.length,
        drafts: drafts.length,
        nextDate
      };
    });

    setClientStats(stats);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-[600px] bg-white rounded-[3rem] animate-pulse border border-black/[0.03]" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between px-2">
        <div>
          <h3 className="text-2xl font-bold flex items-center gap-3 text-brand-dark">
            Operação Canguru
            <span className="px-3 py-1 bg-brand-dark/5 text-brand-dark rounded-full text-xs font-bold">
              {clients.length} Clientes Ativos
            </span>
          </h3>
          <p className="text-sm text-gray-400 mt-1">Visão geral do ecossistema de conteúdo e links estratégicos</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-12">
        {clients.length === 0 ? (
          <div className="col-span-full py-20 bg-white rounded-3xl border border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400">
            <Building2 size={48} className="mb-4 opacity-20" />
            <p className="text-lg font-medium">Nenhum cliente em operação.</p>
          </div>
        ) : (
          clients.map((client) => {
            const stats = clientStats[client.id] || { today: 0, monthTotal: 0, inRevision: 0, inApproval: 0, drafts: 0, nextDate: null };
            const links = quickLinks[client.id] || [];
            
            return (
              <motion.div
                key={client.id}
                whileHover={{ y: -4 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className="group bg-white p-5 rounded-3xl border border-black/[0.03] shadow-sm hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col relative overflow-hidden"
              >
                {/* Decoration */}
                <div 
                  onClick={() => onSelectClient(client)}
                  className="absolute inset-0 z-0 cursor-pointer"
                />

                {/* Header */}
                <div className="flex items-center justify-between mb-5 relative z-10 pointer-events-none">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-[10px] flex items-center justify-center text-white font-bold text-lg shadow-sm overflow-hidden flex-shrink-0"
                      style={{ backgroundColor: client.color }}
                    >
                      {client.logo_url ? (
                        <img src={client.logo_url} alt={client.name} className="w-full h-full object-contain mix-blend-multiply p-1" />
                      ) : (
                        client.initials
                      )}
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-gray-900 flex items-center gap-2">
                        {client.name}
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
                      </h4>
                      <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mt-0.5 max-w-[150px] truncate">{client.segment || 'Segmento'}</p>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingQuickLinksClient(client);
                    }}
                    className="p-2 bg-gray-50 text-gray-400 hover:text-brand-dark hover:bg-gray-100 rounded-xl transition-all pointer-events-auto cursor-pointer border border-transparent shadow-sm hover:border-gray-200"
                    title="Configurar Links Rápidos"
                  >
                    <Settings size={16} />
                  </button>
                </div>

                {/* Publications Stats Grid */}
                <div className="grid grid-cols-2 gap-4 mb-4 pb-4 border-b border-gray-50 relative z-10 pointer-events-none">
                  <div className="space-y-1">
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Publicações Hoje</p>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xl font-black text-brand-dark">{stats.today}</span>
                      {stats.today > 0 && <CheckCircle2 size={14} className="text-green-500" />}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Total no Mês</p>
                    <span className="text-xl font-black text-brand-dark">{stats.monthTotal}</span>
                  </div>
                  <div className={`space-y-1 p-2 rounded-xl transition-colors ${stats.inRevision > 0 ? 'bg-red-50 border border-red-100' : ''}`}>
                    <p className={`text-[9px] font-bold uppercase tracking-widest ${stats.inRevision > 0 ? 'text-red-600' : 'text-red-500/80'}`}>Em Alteração</p>
                    <span className={`text-xl font-black ${stats.inRevision > 0 ? 'text-red-700' : 'text-red-500'}`}>{stats.inRevision}</span>
                  </div>
                  <div className={`space-y-1 p-2 rounded-xl transition-colors ${stats.inApproval > 0 ? 'bg-orange-50 border border-orange-100' : ''}`}>
                    <p className={`text-[9px] font-bold uppercase tracking-widest ${stats.inApproval > 0 ? 'text-orange-600' : 'text-orange-500/80'}`}>Em Aprovação</p>
                    <span className={`text-xl font-black ${stats.inApproval > 0 ? 'text-orange-700' : 'text-orange-500'}`}>{stats.inApproval}</span>
                  </div>
                </div>

                {/* Next Publication & Drafts */}
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-50 relative z-10 pointer-events-none">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-blue-500 flex-shrink-0" />
                    <div>
                      <p className="text-[8px] text-gray-400 font-bold uppercase tracking-widest">Próxima Publicação</p>
                      <p className="text-[11px] font-bold text-gray-700">{stats.nextDate || 'Nenhuma agendada'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] text-gray-400 font-bold uppercase tracking-widest">Rascunhos</p>
                    <p className="text-[11px] font-bold text-gray-500">{stats.drafts}</p>
                  </div>
                </div>

                {/* Dynamic Quick Links Section */}
                <div className="relative z-10 pointer-events-auto mt-auto">
                  <div className="flex flex-wrap gap-2">
                    {links.length > 0 ? (
                      links.map(link => {
                        let Icon = ExternalLink;
                        let colorClass = 'text-gray-500';
                        if (link.type === 'instagram') { Icon = Instagram; colorClass = 'text-pink-500'; }
                        if (link.type === 'meta_ads') { Icon = Monitor; colorClass = 'text-blue-600'; }
                        if (link.type === 'google_ads') { Icon = Globe; colorClass = 'text-green-500'; }
                        if (link.type === 'reportei') { Icon = BarChart2; colorClass = 'text-blue-500'; }

                        return (
                          <a 
                            key={link.id}
                            href={link.url}
                            target="_blank" 
                            rel="noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-white rounded-lg transition-all border border-gray-100 hover:border-brand-dark/20 hover:shadow-sm"
                            title={link.label}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Icon size={12} className={colorClass} />
                            <span className="text-[10px] font-bold text-gray-600 max-w-[80px] truncate">{link.label}</span>
                          </a>
                        );
                      })
                    ) : (
                      <p className="text-[10px] text-gray-400 font-medium py-1">Nenhum link rápido configurado.</p>
                    )}
                  </div>
                </div>

              </motion.div>
            );
          })
        )}
      </div>

      {editingQuickLinksClient && (
        <QuickLinksEditorModal 
          client={editingQuickLinksClient}
          onClose={() => setEditingQuickLinksClient(null)}
          onUpdate={() => {
            fetchAllData();
          }}
        />
      )}
    </div>
  );
};

