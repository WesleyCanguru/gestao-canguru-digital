import React, { useState } from 'react';
import { supabase, useAuth } from '../../lib/supabase';
import { CURRENCIES, CurrencyCode } from '../../lib/money';
import { X, Loader2, Sparkles, AlertCircle } from 'lucide-react';

interface NewProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (proposal: any) => void;
}

const slugify = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

export const NewProposalModal: React.FC<NewProposalModalProps> = ({ isOpen, onClose, onCreated }) => {
  const { agencyId } = useAuth();
  const [prospectName, setProspectName] = useState('');
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManual, setSlugManual] = useState(false);
  const [currency, setCurrency] = useState<CurrencyCode>('BRL');
  const [setupValue, setSetupValue] = useState('');
  const [monthlyValue, setMonthlyValue] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleNameChange = (val: string) => {
    setProspectName(val);
    if (!slugManual) {
      setSlug(slugify(val));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prospectName.trim()) {
      setError('Informe o nome do prospect.');
      return;
    }
    const finalSlug = slug.trim() || slugify(prospectName);
    if (!finalSlug) {
      setError('Informe um link (slug) válido.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Cria a estrutura padrão de conteúdo da proposta
      const numSetup = setupValue ? parseFloat(setupValue.replace(',', '.')) : null;
      const numMonthly = monthlyValue ? parseFloat(monthlyValue.replace(',', '.')) : null;

      const content = {
        eyebrow: title ? `Marketing para ${title}` : 'Proposta comercial',
        headline: `A estratégia certa para acelerar os resultados da ${prospectName}.`,
        lead: notes || `Proposta personalizada com implantação, alinhamento editorial, campanhas e acompanhamento em tempo real.`,
        understanding: {
          facts: [
            { label: 'Empresa', value: prospectName },
            { label: 'Foco', value: title || 'Expansão e vendas' },
            { label: 'Objetivo', value: 'Atrair clientes qualificados todos os dias' },
            { label: 'Canais', value: 'Anúncios, redes sociais e WhatsApp' },
          ],
          text: notes || 'Alinhamos o formato de trabalho e as entregas para acelerar o crescimento da marca.',
        },
        scope: {
          title: 'Como vamos trabalhar',
          items: [
            { title: 'Presença digital e padrão visual.', desc: 'Linha editorial profissional e publicações consistentes com a sua marca.' },
            { title: 'Anúncios no Meta e no Google.', desc: 'Campanhas segmentadas para atrair clientes prontos para comprar.' },
            { title: 'Automações e agilidade.', desc: 'Triagem rápida dos contatos para não deixar nenhum lead esfriar.' },
            { title: 'Painel em tempo real na Bolsa.', desc: 'Acompanhe investimento, conversões e o fluxo completo de contatos.' },
          ],
        },
        investment: {
          setup: numSetup ? {
            title: 'Implantação',
            price: numSetup,
            items: [
              'Configuração inicial das contas de anúncio',
              'Ajuste de perfis e padrão de comunicação',
              'Configuração do painel e CRM na Bolsa',
            ],
          } : undefined,
          monthly: numMonthly ? {
            title: 'Mensalidade',
            price: numMonthly,
            items: [
              'Gestão contínua de campanhas e anúncios',
              'Otimização semanal de criativos e verba',
              'Acompanhamento de resultados e relatórios',
            ],
          } : undefined,
          notes: 'O investimento em mídia pago diretamente às plataformas (Meta e Google) é definido em conjunto e não está incluso na nossa mensalidade.',
        },
        next_steps: [
          { title: 'Aprovação da proposta', desc: 'Você confirma o interesse pelo botão do WhatsApp abaixo.' },
          { title: 'Conversa de alinhamento', desc: 'Definimos acessos, prioridades e o primeiro ciclo de entregas.' },
          { title: 'Primeiras campanhas no ar', desc: 'Tudo pronto e rodando para gerar os primeiros contatos.' },
        ],
        cta: {
          title: 'Faz sentido para você?',
          text: 'Se algo não couber agora ou você quiser ajustar o formato, me fala que alinhamos juntos.',
          whatsapp_number: whatsapp.replace(/\D/g, ''),
          whatsapp_text: `Olá! Vi a proposta da ${prospectName} e quero dar o próximo passo.`,
        },
      };

      const { data, error: insertErr } = await supabase.from('proposals').insert({
        agency_id: agencyId || 1,
        slug: finalSlug,
        prospect_name: prospectName.trim(),
        title: title.trim() || null,
        monthly_value: numMonthly,
        setup_value: numSetup,
        currency,
        status: 'published',
        whatsapp: whatsapp.replace(/\D/g, '') || null,
        content,
      }).select().single();

      if (insertErr) {
        if (insertErr.code === '23505') {
          throw new Error('Já existe uma proposta com este link (slug). Escolha outro.');
        }
        throw insertErr;
      }

      onCreated(data);
      onClose();
    } catch (err: any) {
      console.error('Erro ao criar proposta:', err);
      setError(err?.message || 'Não foi possível criar a proposta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative my-8">
        <button
          onClick={onClose}
          className="absolute right-5 top-5 p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-2 mb-2">
          <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
            <Sparkles size={20} />
          </span>
          <h3 className="text-xl font-bold text-gray-900 tracking-tight">Nova Proposta</h3>
        </div>
        <p className="text-xs text-gray-500 mb-6">
          Gera uma proposta comercial com link público exclusivo, rastreamento de leitura e clique no WhatsApp.
        </p>

        {error && (
          <div className="mb-5 p-3 rounded-xl bg-red-50 text-red-700 text-xs flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Nome do prospect ou empresa *</label>
            <input
              type="text"
              required
              value={prospectName}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Ex.: Álvaro Pétrus ou Pétrus Viagens"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Título ou segmento</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Marketing para agência de viagens"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Link da proposta (/p/slug)</label>
            <div className="flex items-center">
              <span className="px-3 py-2.5 bg-gray-50 border border-r-0 border-gray-200 text-gray-400 text-xs rounded-l-xl select-none">
                /p/
              </span>
              <input
                type="text"
                required
                value={slug}
                onChange={(e) => {
                  setSlugManual(true);
                  setSlug(slugify(e.target.value));
                }}
                placeholder="nome-do-cliente"
                className="w-full px-3.5 py-2.5 rounded-r-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Moeda</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Implantação</label>
              <input
                type="text"
                value={setupValue}
                onChange={(e) => setSetupValue(e.target.value)}
                placeholder="Ex.: 1500"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Mensalidade</label>
              <input
                type="text"
                value={monthlyValue}
                onChange={(e) => setMonthlyValue(e.target.value)}
                placeholder="Ex.: 3000"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">WhatsApp para contato</label>
            <input
              type="text"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="Ex.: 5511999999999"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Entendimento / Anotações da conversa</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Principais dores, demanda atual e o que ficou acordado..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
            />
          </div>

          <div className="pt-3 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-gray-900 text-white text-xs font-semibold hover:bg-black transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Criando...</span>
                </>
              ) : (
                'Criar Proposta'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
