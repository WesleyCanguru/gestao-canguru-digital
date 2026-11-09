import React, { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { formatMoney } from '../../lib/money';
import { MessageCircle, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface ProposalContent {
  eyebrow?: string;
  headline?: string;
  lead?: string;
  understanding?: {
    facts?: { label: string; value: string }[];
    text?: string;
    quote?: string;
    quote_author?: string;
  };
  scope?: {
    title?: string;
    items?: { title: string; desc: string }[];
  };
  investment?: {
    setup?: { title?: string; price?: number; items?: string[] };
    monthly?: { title?: string; price?: number; items?: string[] };
    notes?: string;
    delivery_note?: string;
  };
  next_steps?: { title: string; desc: string }[];
  cta?: {
    title?: string;
    text?: string;
    whatsapp_number?: string;
    whatsapp_text?: string;
  };
}

interface ProposalData {
  id: string;
  slug: string;
  prospect_name: string;
  title: string | null;
  monthly_value: number | null;
  setup_value: number | null;
  currency: string | null;
  whatsapp: string | null;
  content: ProposalContent | null;
  created_at: string;
  agency_id: number;
}

interface AgencyData {
  name: string;
  logo_url: string | null;
  primary_color: string | null;
  contact_whatsapp: string | null;
}

const isPreviewDevice = () => {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  try {
    if (params.get('preview') === 'off') localStorage.removeItem('bolsa_preview');
    else if (params.has('preview')) localStorage.setItem('bolsa_preview', '1');
    return localStorage.getItem('bolsa_preview') === '1';
  } catch {
    return params.has('preview') && params.get('preview') !== 'off';
  }
};

const inFrame = () => {
  if (typeof window === 'undefined') return false;
  try { return window.self !== window.top; } catch { return true; }
};

const getSessionId = () => {
  if (typeof window === 'undefined') return '';
  try {
    let s = sessionStorage.getItem('pt_sid');
    if (!s) {
      s = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem('pt_sid', s);
    }
    return s;
  } catch {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
};

export const ProposalPublicPage: React.FC<{ slug: string }> = ({ slug }) => {
  const [proposal, setProposal] = useState<ProposalData | null>(null);
  const [agency, setAgency] = useState<AgencyData | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'notfound'>('loading');
  const [preview] = useState(() => isPreviewDevice());
  const [framed] = useState(() => inFrame());
  const noTrack = preview || framed;
  const tracked = useRef(false);

  const loadData = useCallback(async () => {
    try {
      const { data: p, error } = await supabase
        .from('proposals')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();

      if (error || !p) {
        setState('notfound');
        return;
      }

      setProposal(p as ProposalData);

      if (p.agency_id) {
        const { data: a } = await supabase
          .from('agencies')
          .select('name, logo_url, primary_color, contact_whatsapp')
          .eq('id', p.agency_id)
          .maybeSingle();
        setAgency(a as AgencyData);
      }

      setState('ok');
    } catch (err) {
      console.error(err);
      setState('notfound');
    }
  }, [slug]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Analytics tracking (only when not in preview and not iframe)
  useEffect(() => {
    if (state !== 'ok' || !proposal || noTrack || tracked.current) return;
    tracked.current = true;

    const sid = getSessionId();

    const sendEvent = async (event: string, extra: Record<string, unknown> = {}) => {
      try {
        await supabase.from('proposal_events').insert({
          proposal_id: proposal.id,
          event_type: event,
          session_id: sid,
          user_agent: navigator.userAgent.slice(0, 300),
          ...extra,
        });
      } catch (e) {
        // tracking fails silently
      }
    };

    sendEvent('open');

    let visibleSeconds = 0;
    let lastTime = Date.now();
    let isActive = !document.hidden;

    const tick = () => {
      if (isActive) {
        visibleSeconds += (Date.now() - lastTime) / 1000;
      }
      lastTime = Date.now();
    };

    const handleVisibility = () => {
      tick();
      isActive = !document.hidden;
      if (document.hidden && visibleSeconds > 0) {
        sendEvent('read_time', { seconds: Math.round(visibleSeconds) });
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    const interval = setInterval(() => {
      tick();
      if (visibleSeconds > 0) {
        sendEvent('read_time', { seconds: Math.round(visibleSeconds) });
      }
    }, 30000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(interval);
    };
  }, [state, proposal, noTrack]);

  const handleWhatsappClick = () => {
    if (!proposal || noTrack) return;
    const sid = getSessionId();
    supabase.from('proposal_events').insert({
      proposal_id: proposal.id,
      event_type: 'whatsapp_click',
      session_id: sid,
      user_agent: navigator.userAgent.slice(0, 300),
    }).then(() => {});
  };

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-[#F5F7FB] flex items-center justify-center p-6 text-gray-400">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (state === 'notfound' || !proposal) {
    return (
      <div className="min-h-screen bg-[#F5F7FB] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-400 mb-4">
          <AlertCircle size={24} />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-1">Proposta não encontrada</h1>
        <p className="text-sm text-gray-500 max-w-sm">
          Este link pode ter expirado ou estar incorreto. Verifique com a pessoa que enviou a proposta.
        </p>
      </div>
    );
  }

  const c = proposal.content || {};
  const agencyName = agency?.name || 'Canguru Digital';
  const whatsappNumber = c.cta?.whatsapp_number || proposal.whatsapp || agency?.contact_whatsapp || '5511994075149';
  const whatsappText = encodeURIComponent(
    c.cta?.whatsapp_text || `Olá! Vi a proposta da ${proposal.prospect_name} e quero conversar.`
  );
  const whatsappUrl = `https://wa.me/${whatsappNumber.replace(/\D/g, '')}?text=${whatsappText}`;

  const formattedMonth = new Date(proposal.created_at).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-[#F5F7FB] text-[#13284D] font-['Plus_Jakarta_Sans',sans-serif] text-base leading-relaxed antialiased selection:bg-[#456DA1]/20">
      {/* Banner de visualização da equipe (prévia) */}
      {preview && !framed && (
        <div className="fixed left-1/2 bottom-4 -translate-x-1/2 z-50 bg-[#13284D] text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-lg">
          Visualização da equipe: esta abertura não é registrada.
        </div>
      )}

      <main className="max-w-[760px] mx-auto px-4 sm:px-6 py-10 sm:py-16 flex flex-col gap-11">
        {/* Marca e cabeçalho topo */}
        <div className="flex items-center justify-between gap-3 text-xs sm:text-sm text-[#56647C]">
          <span className="font-bold text-[#13284D] uppercase tracking-wider text-xs">
            {agencyName}
          </span>
          <span>Proposta preparada para {proposal.prospect_name} · {formattedMonth}</span>
        </div>

        {/* Título e Lead */}
        <header className="space-y-3">
          <div className="text-xs font-bold uppercase tracking-widest text-[#456DA1]">
            {c.eyebrow || proposal.title || 'Proposta Comercial'}
          </div>
          <h1 className="text-3xl sm:text-5xl font-semibold font-serif tracking-tight text-[#13284D] leading-[1.1] text-balance">
            {c.headline || `A proposta sob medida para ${proposal.prospect_name}.`}
          </h1>
          <p className="text-base sm:text-lg text-[#56647C] max-w-[62ch] mt-3">
            {c.lead || `Apresentamos as frentes de trabalho, escopo de entregas e os investimentos planejados para o seu projeto.`}
          </p>
        </header>

        {/* Entendimento */}
        {c.understanding && (
          <section className="space-y-4">
            <div className="text-xs font-bold uppercase tracking-widest text-[#456DA1]">
              O que entendemos na nossa conversa
            </div>
            {c.understanding.facts && c.understanding.facts.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {c.understanding.facts.map((f, i) => (
                  <div key={i} className="bg-white border border-[#DCE3EE] rounded-2xl p-4 shadow-sm">
                    <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#56647C]">
                      {f.label}
                    </span>
                    <strong className="block text-sm font-semibold text-[#13284D] mt-0.5">
                      {f.value}
                    </strong>
                  </div>
                ))}
              </div>
            )}
            {c.understanding.text && (
              <p className="text-sm sm:text-base text-[#13284D]/90">
                {c.understanding.text}
              </p>
            )}
            {c.understanding.quote && (
              <div className="border-l-4 border-[#C8903C] pl-4 py-1 font-serif text-lg text-[#13284D]">
                "{c.understanding.quote}"
                {c.understanding.quote_author && (
                  <small className="block font-sans text-xs text-[#56647C] mt-1 font-normal">
                    {c.understanding.quote_author}
                  </small>
                )}
              </div>
            )}
          </section>
        )}

        {/* Escopo / Como vamos trabalhar */}
        {c.scope && c.scope.items && c.scope.items.length > 0 && (
          <section className="space-y-4">
            <div className="text-xs font-bold uppercase tracking-widest text-[#456DA1]">
              Como vamos trabalhar
            </div>
            <h2 className="text-2xl sm:text-3xl font-semibold font-serif tracking-tight text-[#13284D]">
              {c.scope.title || 'Frentes de trabalho coordenadas'}
            </h2>
            <ul className="space-y-3">
              {c.scope.items.map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-sm sm:text-base">
                  <span className="w-2 h-2 rounded-sm bg-[#456DA1] mt-2 shrink-0" />
                  <div className="text-[#13284D]">
                    <strong className="font-semibold">{item.title} </strong>
                    <span className="text-[#56647C]">{item.desc}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Investimento */}
        <section className="space-y-4">
          <div className="text-xs font-bold uppercase tracking-widest text-[#456DA1]">
            Investimento
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Implantação */}
            {(proposal.setup_value || c.investment?.setup) && (
              <div className="bg-white border border-[#DCE3EE] rounded-3xl p-6 flex flex-col gap-4 shadow-sm">
                <span className="self-start text-[11px] font-bold uppercase tracking-wider text-[#456DA1] bg-[#E9EFF8] px-2.5 py-1 rounded-full">
                  Uma vez
                </span>
                <h3 className="text-base font-bold text-[#13284D]">
                  {c.investment?.setup?.title || 'Implantação'}
                </h3>
                <div className="font-serif text-3xl font-semibold text-[#13284D] tabular-nums">
                  {formatMoney(c.investment?.setup?.price ?? proposal.setup_value, proposal.currency)}
                </div>
                <ul className="space-y-2 text-xs sm:text-sm text-[#56647C]">
                  {(c.investment?.setup?.items || [
                    'Configuração e parametrização inicial',
                    'Alinhamento de contas e canais',
                    'CRM e painel da Bolsa configurados',
                  ]).map((item, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <CheckCircle size={14} className="text-[#456DA1] shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Mensalidade */}
            {(proposal.monthly_value || c.investment?.monthly) && (
              <div className="bg-white border-2 border-[#456DA1] rounded-3xl p-6 flex flex-col gap-4 shadow-md relative">
                <span className="self-start text-[11px] font-bold uppercase tracking-wider text-[#456DA1] bg-[#E9EFF8] px-2.5 py-1 rounded-full">
                  Mensal
                </span>
                <h3 className="text-base font-bold text-[#13284D]">
                  {c.investment?.monthly?.title || proposal.title || 'Gestão e Campanhas'}
                </h3>
                <div className="font-serif text-3xl font-semibold text-[#13284D] tabular-nums flex items-baseline gap-1.5">
                  {formatMoney(c.investment?.monthly?.price ?? proposal.monthly_value, proposal.currency)}
                  <small className="font-sans text-xs text-[#56647C] font-normal">/ mês</small>
                </div>
                <ul className="space-y-2 text-xs sm:text-sm text-[#56647C]">
                  {(c.investment?.monthly?.items || [
                    'Gestão contínua de campanhas e publicações',
                    'Otimizações semanais de orçamento e criativos',
                    'Painel de acompanhamento ao vivo na Bolsa',
                  ]).map((item, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <CheckCircle size={14} className="text-[#456DA1] shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {c.investment?.notes && (
            <div className="bg-[#E9EFF8] rounded-2xl p-4 text-xs sm:text-sm text-[#13284D]">
              {c.investment.notes}
            </div>
          )}
        </section>

        {/* Próximos passos */}
        {c.next_steps && c.next_steps.length > 0 && (
          <section className="space-y-4">
            <div className="text-xs font-bold uppercase tracking-widest text-[#456DA1]">
              Próximos passos
            </div>
            <div className="space-y-3">
              {c.next_steps.map((st, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="w-8 h-8 rounded-full bg-[#13284D] text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <div>
                    <strong className="block text-sm sm:text-base font-semibold text-[#13284D]">
                      {st.title}
                    </strong>
                    <span className="text-xs sm:text-sm text-[#56647C]">{st.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* CTA final */}
        <section className="bg-[#13284D] text-white rounded-3xl p-6 sm:p-8 flex flex-col gap-4 items-start shadow-xl">
          <h2 className="text-2xl sm:text-3xl font-semibold font-serif text-white">
            {c.cta?.title || 'Faz sentido para você?'}
          </h2>
          <p className="text-sm sm:text-base text-white/80 max-w-[55ch]">
            {c.cta?.text || 'Se algo não couber agora ou precisar de ajuste, me fale que alinhamos juntos.'}
          </p>
          <a
            id="cta-whatsapp"
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleWhatsappClick}
            className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-[#0B2416] font-bold text-sm sm:text-base px-5 py-3.5 rounded-xl transition-all shadow-md active:scale-95"
          >
            <MessageCircle size={18} />
            <span>Falar no WhatsApp</span>
          </a>
        </section>

        {/* Rodapé */}
        <footer className="text-xs text-[#56647C] pt-2 pb-6 border-t border-[#DCE3EE]">
          {agencyName} · Proposta válida por 15 dias.
        </footer>
      </main>
    </div>
  );
};
