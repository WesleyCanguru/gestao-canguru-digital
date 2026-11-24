// Proteção contra XSS: texto vindo do banco nunca vira script na tela.
// escapeHtml: para montar HTML em string (ex.: janela de impressão do PDF).
// htmlToText: tira as tags sem executar nada (DOMParser cria um documento inerte).
// sanitizeHtml: deixa só formatação simples e links http/https/mailto.

export const escapeHtml = (v: unknown): string =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export const htmlToText = (html: string): string => {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
};

const ALLOWED = new Set(['A', 'B', 'STRONG', 'I', 'EM', 'U', 'BR', 'P', 'UL', 'OL', 'LI', 'SPAN', 'CODE']);

export const sanitizeHtml = (html: string): string => {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const clean = (node: Element) => {
    for (const el of Array.from(node.children)) {
      const tag = el.tagName.toUpperCase(); // svg/math vêm em minúsculas
      if (!ALLOWED.has(tag)) {
        if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE', 'SVG', 'MATH', 'NOSCRIPT'].includes(tag)) { el.remove(); continue; }
        clean(el);
        el.replaceWith(...Array.from(el.childNodes));
        continue;
      }
      const href = tag === 'A' ? el.getAttribute('href') || '' : '';
      for (const a of Array.from(el.attributes)) el.removeAttribute(a.name);
      if (tag === 'A' && /^(https?:|mailto:)/i.test(href.trim())) {
        el.setAttribute('href', href.trim());
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener noreferrer');
      }
      clean(el);
    }
  };
  clean(doc.body);
  return doc.body.innerHTML;
};
