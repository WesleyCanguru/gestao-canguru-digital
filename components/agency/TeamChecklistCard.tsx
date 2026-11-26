import React, { useCallback, useEffect, useState } from 'react';
import { supabase, useAuth } from '../../lib/supabase';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';

/**
 * Checklist da equipe dentro do card do cliente (Onboarding › Novos clientes).
 * Usa o modelo da própria agência (onboarding_templates). Não herda o modelo de outra agência.
 * Itens que começam com "[Cliente]" são os que dependem do cliente.
 */

type Item = {
  id: string; phase: number; phase_name: string | null; title: string; description: string | null;
  is_completed: boolean; position: number; parent_id: string | null;
};

const PHASE_LABEL: Record<number, string> = {
  2: 'Depois de fechar', 3: 'Acessos', 4: 'Estratégia', 5: 'Lançamento', 6: 'Acompanhamento',
};

const SERVICE_MAP: Record<string, string> = {
  'Social Media': 'social_media', 'Tráfego Pago': 'trafego_pago', 'E-mail Marketing': 'email_marketing', 'Website': 'website',
};

export const TeamChecklistCard: React.FC<{ client: any }> = ({ client }) => {
  const { agencyId } = useAuth();
  const [items, setItems] = useState<Item[] | null>(null);
  const [noTemplate, setNoTemplate] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('onboarding_checklist').select('*')
      .eq('client_id', client.id).is('parent_id', null).order('phase').order('position');
    setItems((data as Item[]) || []);
  }, [client.id]);

  useEffect(() => { load(); }, [load]);

  const generate = async () => {
    if (!agencyId) return;
    setBusy(true);
    const { data: tpls } = await supabase.from('onboarding_templates').select('*')
      .eq('agency_id', agencyId).eq('is_active', true).is('parent_id', null).order('phase').order('position');
    const services = ((client.services as string[]) || []).map(s => SERVICE_MAP[s] || s);
    const valid = ((tpls as any[]) || []).filter(t => !t.required_services?.length || t.required_services.some((s: string) => services.includes(s)));
    if (!valid.length) { setNoTemplate(true); setBusy(false); return; }
    await supabase.from('onboarding_checklist').insert(valid.map(t => ({
      client_id: client.id, agency_id: agencyId, phase: t.phase, phase_name: t.phase_name, title: t.title,
      description: t.description, is_completed: false, position: t.position, parent_id: null,
    })));
    await load();
    setBusy(false);
  };

  const toggle = async (it: Item) => {
    const done = !it.is_completed;
    setItems(list => (list || []).map(x => (x.id === it.id ? { ...x, is_completed: done } : x)));
    await supabase.from('onboarding_checklist')
      .update({ is_completed: done, completed_at: done ? new Date().toISOString() : null }).eq('id', it.id);
  };

  if (items === null) return null;

  const total = items.length;
  const done = items.filter(i => i.is_completed).length;
  const nextItem = items.find(i => !i.is_completed);
  const phases = Array.from(new Set(items.map(i => i.phase))).sort((a, b) => a - b);

  return (
    <div className="p-5 rounded-2xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h4 className="text-sm font-bold text-gray-900">Checklist da equipe</h4>
        {total > 0 && <span className="text-xs font-semibold text-gray-500">{done} de {total}</span>}
      </div>

      {total === 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <p className="text-sm text-gray-500 flex-1 min-w-[200px]">
            {noTemplate ? 'Esta agência ainda não tem modelo de checklist.' : 'O checklist deste cliente ainda não foi criado.'}
          </p>
          {!noTemplate && (
            <button onClick={generate} disabled={busy}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-gray-900 text-white disabled:opacity-50">
              {busy && <Loader2 size={14} className="animate-spin" />} Criar checklist
            </button>
          )}
        </div>
      ) : (
        <>
          {nextItem && (
            <p className="text-xs text-gray-500 mb-3">
              Próximo: <span className="font-semibold text-gray-800">{nextItem.title.replace(/^\[Cliente\]\s*/, '')}</span>
              {/^\[Cliente\]/.test(nextItem.title) ? ' (bola com o cliente: cobrar no grupo)' : ' (bola com a equipe)'}
            </p>
          )}
          <div className="space-y-4">
            {phases.map(ph => {
              const list = items.filter(i => i.phase === ph);
              return (
                <div key={ph}>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1">
                    {PHASE_LABEL[ph] || list[0]?.phase_name} · {list.filter(i => i.is_completed).length}/{list.length}
                  </p>
                  <ul className="divide-y divide-gray-100">
                    {list.map(it => {
                      const isClient = /^\[Cliente\]/.test(it.title);
                      return (
                        <li key={it.id}>
                          <button type="button" onClick={() => toggle(it)} className="w-full flex items-start gap-3 py-2.5 text-left hover:bg-gray-50 -mx-2 px-2 rounded-lg">
                            {it.is_completed
                              ? <CheckCircle2 size={18} className="shrink-0 mt-0.5 text-emerald-500" />
                              : <Circle size={18} className="shrink-0 mt-0.5 text-gray-300" />}
                            <div className="min-w-0 flex-1">
                              <p className={`text-sm font-semibold ${it.is_completed ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                                {it.title.replace(/^\[Cliente\]\s*/, '')}
                              </p>
                              {it.description && !it.is_completed && <p className="text-xs text-gray-500">{it.description}</p>}
                            </div>
                            {!it.is_completed && (
                              <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${isClient ? 'bg-sky-50 text-sky-700' : 'bg-gray-900 text-white'}`}>
                                {isClient ? 'Cliente' : 'Equipe'}
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
