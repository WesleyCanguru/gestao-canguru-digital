// Follow-ups do CRM da agência (lado do app). A lógica de prazos fica no núcleo compartilhado
// com a Edge Function telegram-briefing.
export * from '../supabase/functions/_shared/followups-core';
import type { AgencyLead } from '../types';

/** Número para wa.me: só dígitos, com 55 quando vier sem DDI. */
export const leadWhatsappNumber = (lead: AgencyLead): string | null => {
  const fd = lead.form_data || {};
  const raw = fd.whatsapp || fd.telefone || fd.phone || fd.celular || '';
  let digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 10 || digits.length === 11) digits = '55' + digits;
  return digits.length >= 12 ? digits : null;
};

export const whatsappLink = (lead: AgencyLead, text: string): string | null => {
  const n = leadWhatsappNumber(lead);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : null;
};
