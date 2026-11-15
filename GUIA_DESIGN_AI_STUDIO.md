# Guia: mudar o visual da Bolsa no Google AI Studio sem quebrar nada

A Bolsa tem muita lógica escondida nas telas (aprovação, e-mails, idiomas, fusos, relatórios). O AI Studio é ótimo para visual e perigoso para lógica. Regra de ouro: **mudar como as coisas parecem, nunca o que elas fazem.**

## 1. Antes de começar
1. Crie uma branch nova no GitHub (ex.: `visual-novo`). Nunca trabalhe direto na `main`.
2. Escolha **uma área por vez**: Início, Painel de Conteúdo, Tráfego, CRM, Relatórios, Login, Portal do cliente. Não peça "mude o site todo" de uma vez.
3. Tenha uma referência visual: print ou link de um sistema que você gosta (Linear, Notion, Stripe, Attio, Framer).

## 2. Como pedir ao AI Studio (copie e ajuste)
> Você é um designer de produto sênior. Quero uma comunicação visual nova para esta tela, no estilo de [referência: ex. Linear/Stripe], com [cores, fontes, sensação: ex. "mais limpa, mais espaço em branco, tipografia Inter, cantos 16px"].
> **Regras obrigatórias:**
> - Mude só classes CSS/Tailwind, cores, espaçamentos, fontes, ícones e a disposição dos blocos.
> - **Não** altere nenhuma função, `useEffect`, chamada ao `supabase`, nome de prop, nome de variável, `onClick`, `t('...')` (traduções) ou texto entre `t(...)`.
> - **Não** apague nenhum botão, campo ou aba, mesmo que pareça repetido.
> - **Não** troque `t('Texto')` por texto fixo. Todo texto visível continua dentro de `t()`.
> - **Não** crie arquivos novos de lógica nem mude `lib/`, `hooks/`, `supabase/`, `api/`.
> - Mantenha os componentes `ViewerTime`, `GlobalSearch`, `BatchPostReview`, `ReportPage` funcionando como estão.
> - Ao final, liste os arquivos que você mudou.

## 3. O que pode e o que não pode mudar
| Pode (visual) | Não pode (lógica) |
|---|---|
| `className`, cores, fontes, sombras, bordas | Qualquer coisa em `lib/`, `hooks/`, `supabase/`, `api/` |
| Ordem e tamanho dos blocos na tela | Chamadas `supabase.from(...)`, `rpc`, `callFunction` |
| Ícones (`lucide-react`) | `useState`, `useEffect`, handlers (`onClick={...}` pode mudar o estilo, não a função chamada) |
| Textos de rótulo **dentro** de `t('...')` (avise o Claude para traduzir) | Textos fora de `t()` em telas do cliente |
| `index.css` e o tema do Tailwind | Rotas no `App.tsx` (`/r/`, `/p/`, `/g/`, `/nps/`, `/criativos/`, `?mode=public`) |

Áreas sensíveis (peça só visual e com cuidado redobrado): `PostModal.tsx`, `MonthDetail.tsx`, `ClientManager.tsx`, `AgencyTasksTab.tsx`, `FinanceiroTab.tsx`, `LeadTrackerView.tsx` (arquivos grandes, muita lógica misturada).

## 4. Depois de cada mudança
1. No GitHub, abra o PR da branch. A Vercel cria um link de prévia.
2. Mande o link do PR para o Claude e peça: **"roda o checklist de visual da Bolsa nesse PR"**. O Claude (Opus ou Fable) confere:
   - o build e os tipos (`tsc`) passam;
   - nada de lógica mudou (lê o diff procurando `supabase`, `useEffect`, handlers, `t(` removidos);
   - as telas abrem na prévia: login, Início da agência, Painel de Conteúdo, post (abrir e fechar), Tarefas e modo foco, Relatórios, Ver como cliente (Studio Bella em PT e Brazuca em EN), link público de post, `/g/onboarding`, `/r/<token>`;
   - o português e o inglês continuam certos (nada em português na Brazuca).
3. Só depois do ok do Claude, faça o merge.

## 5. Se algo quebrar
- Na Vercel, dá para voltar para o deploy anterior em um clique (Deployments › ... › Promote).
- No GitHub, "Revert" no PR desfaz a mudança.
- Erros de tela aparecem em Gestão › Relatórios › Equipe › "Erros nas telas".
