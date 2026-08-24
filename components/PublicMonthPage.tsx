import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Client } from '../types';
import { PublicMonthGate } from './PublicMonthGate';
import { PublicMonthView } from './PublicMonthView';
import { Loader2 } from 'lucide-react';

interface PublicMonthPageProps {
  clientId: string;
  mes: number;
  ano: number;
}

export const PublicMonthPage: React.FC<PublicMonthPageProps> = ({ clientId, mes, ano }) => {
  const [visitorName, setVisitorName] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('visitor_name');
    }
    return null;
  });
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);

  // Buscar dados mínimos do cliente (nome e logo)
  useEffect(() => {
    let isMounted = true;
    
    const fetchClient = async () => {
      try {
        const { data, error } = await supabase
          .from('clients')
          .select('*')
          .eq('id', clientId)
          .single();

        if (!isMounted) return;
        if (!error && data) {
          setClient(data as Client);
        }
      } catch (err) {
        console.error('Erro ao carregar dados do cliente:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchClient();

    return () => {
      isMounted = false;
    };
  }, [clientId]);

  const handleEnter = (name: string) => {
    sessionStorage.setItem('visitor_name', name);
    setVisitorName(name);
  };

  if (loading || !client) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#F4F3EF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Inter, sans-serif'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <Loader2 className="animate-spin text-[#13284D]" size={32} />
          <p style={{ color: '#8A8F98', fontSize: 14, fontWeight: 500 }}>Carregando calendário...</p>
        </div>
      </div>
    );
  }

  if (!visitorName) {
    return (
      <PublicMonthGate
        clientName={client.name}
        clientLogoUrl={client.logo_url}
        mes={mes}
        ano={ano}
        onEnter={handleEnter}
      />
    );
  }

  return (
    <PublicMonthView
      clientId={clientId}
      clientName={client.name}
      clientLogoUrl={client.logo_url}
      mes={mes}
      ano={ano}
      visitorName={visitorName}
      agencyId={client.agency_id}
      overrideClient={client}
    />
  );
};
