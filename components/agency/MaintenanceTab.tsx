
import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { RefreshCw, Check, AlertCircle } from 'lucide-react';

export const MaintenanceTab: React.FC = () => {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const syncThemes = async () => {
    setStatus('loading');
    setMessage('Buscando cliente Next Safety...');
    
    try {
      // 1. Encontrar o cliente Next Safety
      const { data: nextSafety, error: clientError } = await supabase
        .from('clients')
        .select('id, name')
        .ilike('name', '%Next Safety%')
        .single();

      if (clientError || !nextSafety) {
        throw new Error('Cliente Next Safety não encontrado.');
      }

      setMessage(`Cliente Next Safety encontrado (ID: ${nextSafety.id}). Buscando planos...`);

      // 2. Buscar planos do Next Safety para Maio em diante
      const { data: nextSafetyPlans, error: plansError } = await supabase
        .from('client_monthly_plans')
        .select('*')
        .eq('client_id', nextSafety.id)
        .eq('year', 2026)
        .gte('month', 5);

      if (plansError || !nextSafetyPlans || nextSafetyPlans.length === 0) {
        throw new Error('Planos de Maio em diante não encontrados para Next Safety.');
      }

      setMessage(`Encontrados ${nextSafetyPlans.length} planos. Buscando outros clientes...`);

      // 3. Buscar todos os outros clientes ativos
      const { data: otherClients, error: othersError } = await supabase
        .from('clients')
        .select('id, name')
        .neq('id', nextSafety.id)
        .eq('is_active', true);

      if (othersError || !otherClients) {
        throw new Error('Erro ao buscar outros clientes.');
      }

      setMessage(`Sincronizando temas para ${otherClients.length} clientes...`);

      // 4. Para cada cliente, atualizar os temas de Maio em diante
      for (const client of otherClients) {
        for (const plan of nextSafetyPlans) {
          // Usar upsert para garantir que o plano seja criado ou atualizado
          const { error: updateError } = await supabase
            .from('client_monthly_plans')
            .upsert([{ 
              client_id: client.id,
              month: plan.month,
              year: plan.year,
              theme: plan.theme,
              objectives: [],
              key_dates: [],
              campaigns: [],
              updated_at: new Date().toISOString()
            }], { onConflict: 'client_id,month,year' });

          if (updateError) {
            console.error(`Erro ao atualizar ${client.name} - Mês ${plan.month}:`, updateError);
          }
        }
      }

      setStatus('success');
      setMessage('Temas sincronizados com sucesso para todos os clientes ativos!');
    } catch (error: any) {
      console.error('Erro na sincronização:', error);
      setStatus('error');
      setMessage(error.message || 'Erro desconhecido ao sincronizar temas.');
    }
  };

  return (
    <div className="bg-white rounded-[2.5rem] p-10 border border-black/[0.03] shadow-sm max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-600">
          <RefreshCw size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-brand-dark">Manutenção de Temas</h2>
          <p className="text-sm text-gray-500 font-medium">Sincronize os temas amplos da Next Safety para os outros clientes.</p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="p-6 bg-gray-50 rounded-3xl border border-gray-100">
          <p className="text-sm text-gray-600 leading-relaxed">
            Esta ação irá copiar os <strong>Temas do Mês</strong> da conta <strong>Next Safety</strong> (de Maio de 2026 em diante) 
            e aplicá-los a <strong>todos os outros clientes ativos</strong> no sistema. Além disso, irá limpar os objetivos, datas e campanhas desses meses.
          </p>
        </div>

        {status === 'loading' && (
          <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-100 rounded-2xl text-blue-700 text-sm animate-pulse">
            <RefreshCw size={18} className="animate-spin" />
            {message}
          </div>
        )}

        {status === 'success' && (
          <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-100 rounded-2xl text-green-700 text-sm">
            <Check size={18} />
            {message}
          </div>
        )}

        {status === 'error' && (
          <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-700 text-sm">
            <AlertCircle size={18} />
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4">
          <button
            onClick={syncThemes}
            disabled={status === 'loading'}
            className="w-full py-4 bg-brand-dark text-white rounded-2xl font-bold uppercase tracking-widest hover:shadow-xl transition-all transform hover:-translate-y-1 disabled:opacity-50 disabled:transform-none"
          >
            {status === 'loading' ? 'Sincronizando...' : 'Sincronizar Temas (Maio em diante)'}
          </button>

          <button
            onClick={async () => {
              setStatus('loading');
              setMessage('Limpando Visão Geral Anual de todos os clientes...');
              try {
                const { data: clients } = await supabase.from('clients').select('id');
                if (!clients) throw new Error('Nenhum cliente encontrado.');
                
                for (const client of clients) {
                  await supabase
                    .from('client_annual_overview')
                    .update({
                      description: '',
                      pillar1_title: '', pillar1_description: '',
                      pillar2_title: '', pillar2_description: '',
                      pillar3_title: '', pillar3_description: '',
                      updated_at: new Date().toISOString()
                    })
                    .eq('client_id', client.id);
                }
                setStatus('success');
                setMessage('Visão Geral Anual limpa para todos os clientes!');
              } catch (err: any) {
                setStatus('error');
                setMessage(err.message);
              }
            }}
            disabled={status === 'loading'}
            className="w-full py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold uppercase tracking-widest hover:bg-gray-200 transition-all disabled:opacity-50"
          >
            Limpar Visão Geral Anual (Todos os Clientes)
          </button>
        </div>
      </div>
    </div>
  );
};
