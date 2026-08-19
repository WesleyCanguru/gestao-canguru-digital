import React, { useState, useEffect } from 'react';
import { supabase, useAuth } from '../../lib/supabase';
import { Client } from '../../types';
import { ClientPainelConteudo } from '../client/ClientPainelConteudo';
import { Loader2 } from 'lucide-react';

interface NossoConteudoTabProps {
  initialTab?: 'dashboard' | 'publicacoes' | 'mapa';
  initialFilterStatus?: string;
  initialFilterPeriod?: string;
}

export const NossoConteudoTab: React.FC<NossoConteudoTabProps> = ({
  initialTab,
  initialFilterStatus,
  initialFilterPeriod
}) => {
  const { agencyId } = useAuth();
  const [internalClient, setInternalClient] = useState<Client | null>(null);
  const [loadingClient, setLoadingClient] = useState(true);

  useEffect(() => {
    async function loadInternalClient() {
      try {
        setLoadingClient(true);
        let query = supabase
          .from('clients')
          .select('*')
          .eq('is_internal', true)
          .limit(1);

        if (agencyId) {
          query = query.eq('agency_id', agencyId);
        }

        let { data, error } = await query;
        if (error) throw error;

        if (data && data.length > 0) {
          setInternalClient(data[0] as Client);
        } else {
          // Fallback ID fixo da agência Canguru se não encontrar
          const knownId = agencyId === 1 ? 'b0febf12-6d64-4754-ac4e-e2e1405e616c' : null;
          if (knownId) {
            const { data: byId } = await supabase
              .from('clients')
              .select('*')
              .eq('id', knownId)
              .maybeSingle();
            if (byId) {
              setInternalClient(byId as Client);
              return;
            }
          }

          // Se ainda não encontrar, insere cliente interno da agência
          const agencyName = agencyId === 2 ? 'Kanoa Studio' : 'Canguru Digital';
          const { data: newClient, error: createErr } = await supabase
            .from('clients')
            .insert({
              id: knownId || undefined,
              name: agencyName,
              responsible: agencyName,
              is_internal: true,
              agency_id: agencyId || 1
            })
            .select()
            .single();

          if (!createErr && newClient) {
            setInternalClient(newClient as Client);
          }
        }
      } catch (e) {
        console.error('Erro ao carregar cliente interno para Nosso Conteúdo:', e);
      } finally {
        setLoadingClient(false);
      }
    }

    loadInternalClient();
  }, [agencyId]);

  if (loadingClient || !internalClient || !internalClient.id) {
    return (
      <div className="py-20 text-center text-stone-400 flex flex-col items-center justify-center">
        <Loader2 size={32} className="animate-spin text-brand-dark mb-3" />
        <p className="text-sm font-medium">Carregando Nosso Conteúdo...</p>
      </div>
    );
  }

  return (
    <ClientPainelConteudo
      overrideClient={internalClient}
      isNossoConteudo={true}
      titleOverride="Nosso Conteúdo"
      subtitleOverride="Gestão do planejamento editorial, publicações e mapa estratégico da agência"
      initialTab={initialTab}
      initialFilterStatus={initialFilterStatus}
      initialFilterPeriod={initialFilterPeriod}
    />
  );
};

export default NossoConteudoTab;
