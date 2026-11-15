// Monitor de erros simples: manda para a tabela app_errors (sem serviço externo).
// O mesmo erro na mesma página conta uma vez por hora (o resto vira contador).
import { supabase } from './supabase';

let installed = false;
let ctx: { agency: number | null; isClient: boolean | null } = { agency: null, isClient: null };
/** Chamado pelo App quando sabe a agência e o tipo de usuário. */
export const setErrorContext = (agency: number | null | undefined, isClient: boolean | null | undefined) => { ctx = { agency: agency ?? null, isClient: isClient ?? null }; };
let sentThisPage = 0;
const IGNORE = /ResizeObserver loop|Script error\.?$|OneSignal|Non-Error promise rejection|Load failed|Failed to fetch dynamically imported module/i;

export const logError = (message: string, stack?: string | null) => {
  if (!message || IGNORE.test(message) || sentThisPage > 20) return;
  sentThisPage++;
  const { agency, isClient } = ctx;
  supabase.rpc('log_app_error', { p_message: message.slice(0, 1000), p_stack: (stack || '').slice(0, 4000), p_url: location.href.slice(0, 500), p_ua: navigator.userAgent.slice(0, 300), p_agency: agency, p_is_client: isClient })
    .then(() => {}, () => {});
};

export const installErrorLog = () => {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('error', (e) => logError(e.message || String(e.error), e.error?.stack));
  window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
    const r: any = e.reason;
    logError(r?.message || String(r), r?.stack);
  });
};
