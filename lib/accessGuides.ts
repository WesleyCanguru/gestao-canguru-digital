// Passo a passo para o cliente dar acesso (ou criar) as contas de anúncio.
// Usado no cadastro público e no portal do cliente, nos três idiomas.

export type Lang = 'pt' | 'en' | 'es';
export type Platform = 'meta' | 'google';

export const LANGS: { id: Lang; label: string }[] = [
  { id: 'pt', label: 'Português' },
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Español' },
];

export const pickLang = (l?: string | null): Lang => (l === 'en' || l === 'es' || l === 'pt' ? l : 'pt');

export const browserLang = (): Lang => {
  if (typeof navigator === 'undefined') return 'pt';
  const n = (navigator.language || 'pt').toLowerCase();
  if (n.startsWith('es')) return 'es';
  if (n.startsWith('en')) return 'en';
  return 'pt';
};

/** Tradutor simples: tr(lang)('texto pt', 'text en', 'texto es') */
export const tr = (lang: Lang) => (pt: string, en: string, es: string) => (lang === 'en' ? en : lang === 'es' ? es : pt);

export interface GuideStep {
  text: string;
  sub?: string[];
}

export interface PlatformGuide {
  name: string;
  link: string;
  linkLabel: string;
  hasAccount: GuideStep[];
  refLabel: string;
  refPlaceholder: string;
  noAccountIntro: string;
  noAccount: GuideStep[];
  noAccountLink?: string;
  noAccountLinkLabel?: string;
}

export const platformGuide = (p: Platform, lang: Lang): PlatformGuide => {
  const t = tr(lang);
  if (p === 'meta') {
    return {
      name: 'Meta (Facebook e Instagram)',
      link: 'https://business.facebook.com/latest/settings/people',
      linkLabel: t('Abrir Meta Business', 'Open Meta Business', 'Abrir Meta Business'),
      hasAccount: [
        {
          text: t(
            'Abra o Meta Business pelo botão abaixo. Se aparecer uma lista de empresas, escolha a da sua marca.',
            'Open Meta Business with the button below. If you see a list of businesses, choose the one for your brand.',
            'Abre Meta Business con el botón de abajo. Si aparece una lista de empresas, elige la de tu marca.'
          ),
        },
        {
          text: t(
            'Se não abrir direto na tela "Pessoas":',
            'If it does not open directly on the "People" screen:',
            'Si no abre directamente en la pantalla "Personas":'
          ),
          sub: [
            t('Clique na engrenagem (Configurações), no menu da esquerda.', 'Click the gear icon (Settings) in the left menu.', 'Haz clic en el engranaje (Configuración), en el menú de la izquierda.'),
            t('Clique em "Configurações da empresa".', 'Click "Business settings".', 'Haz clic en "Configuración del negocio".'),
            t('Em "Usuários", clique em "Pessoas".', 'Under "Users", click "People".', 'En "Usuarios", haz clic en "Personas".'),
          ],
        },
        {
          text: t(
            'Clique no botão azul "Convidar pessoas" e cole o e-mail da agência.',
            'Click the blue "Invite people" button and paste the agency email.',
            'Haz clic en el botón azul "Invitar personas" y pega el correo de la agencia.'
          ),
        },
        {
          text: t(
            'Em "Conceder acesso":',
            'Under "Grant access":',
            'En "Otorgar acceso":'
          ),
          sub: [
            t('Em "Acesso total", ligue "Gerenciar".', 'Under "Full control", turn on "Manage".', 'En "Control total", activa "Gestionar".'),
            t('Abra "Ver opções avançadas" e, em "Finanças", ligue "Gerenciar". Clique em "Avançar".', 'Open "View advanced options" and, under "Finance", turn on "Manage". Click "Next".', 'Abre "Ver opciones avanzadas" y, en "Finanzas", activa "Gestionar". Haz clic en "Siguiente".'),
          ],
        },
        {
          text: t(
            'Em "Atribuir ativos", para cada tipo da lista da esquerda:',
            'Under "Assign assets", for each type on the left list:',
            'En "Asignar activos", para cada tipo de la lista de la izquierda:'
          ),
          sub: [
            t('Páginas do Facebook: marque a sua Página e, embaixo, em "Acesso total", ligue "Tudo".', 'Facebook Pages: select your Page and, below under "Full control", turn on "Everything".', 'Páginas de Facebook: marca tu Página y, abajo en "Control total", activa "Todo".'),
            t('Contas de anúncios: marque a conta e, em "Acesso total", ligue "Gerenciar contas de anúncios".', 'Ad accounts: select the account and, under "Full control", turn on "Manage ad accounts".', 'Cuentas publicitarias: marca la cuenta y, en "Control total", activa "Gestionar cuentas publicitarias".'),
            t('Instagram e Pixels (se aparecerem): marque e ligue o acesso total.', 'Instagram and Pixels (if they appear): select them and turn on full control.', 'Instagram y Píxeles (si aparecen): márcalos y activa el control total.'),
            t('Apps: não precisa marcar nada.', 'Apps: you do not need to select anything.', 'Apps: no es necesario marcar nada.'),
          ],
        },
        {
          text: t(
            'Clique em "Avançar", confira o resumo e clique em "Convidar com X ativos". Pronto!',
            'Click "Next", check the summary and click "Invite with X assets". Done!',
            'Haz clic en "Siguiente", revisa el resumen y haz clic en "Invitar con X activos". ¡Listo!'
          ),
        },
      ],
      refLabel: t('ID da conta de anúncios (opcional)', 'Ad account ID (optional)', 'ID de la cuenta publicitaria (opcional)'),
      refPlaceholder: 'act_123456789',
      noAccountIntro: t('Dá para criar sozinho em poucos minutos. Você fica como dono de tudo.',
        'You can create it yourself in a few minutes. You stay the owner of everything.',
        'Puedes crearla tú mismo en pocos minutos. Tú quedas como dueño de todo.'),
      noAccount: [
        {
          text: t(
            'Abra o Meta Business pelo botão abaixo e entre com o seu Facebook pessoal.',
            'Open Meta Business with the button below and log in with your personal Facebook.',
            'Abre Meta Business con el botón de abajo e inicia sesión con tu Facebook personal.'
          ),
        },
        {
          text: t(
            'Clique em "Criar conta" (ou "Criar portfólio empresarial") e preencha o nome da empresa, o seu nome e o e-mail comercial.',
            'Click "Create account" (or "Create business portfolio") and fill in the company name, your name and your work email.',
            'Haz clic en "Crear cuenta" (o "Crear portafolio comercial") y completa el nombre de la empresa, tu nombre y tu correo comercial.'
          ),
        },
        {
          text: t(
            'Crie a conta de anúncios:',
            'Create the ad account:',
            'Crea la cuenta publicitaria:'
          ),
          sub: [
            t('Clique na engrenagem (Configurações) e depois em "Configurações da empresa".', 'Click the gear icon (Settings) and then "Business settings".', 'Haz clic en el engranaje (Configuración) y luego en "Configuración del negocio".'),
            t('No menu "Contas", clique em "Contas de anúncios".', 'In the "Accounts" menu, click "Ad accounts".', 'En el menú "Cuentas", haz clic en "Cuentas publicitarias".'),
            t('Clique em "Adicionar" e depois em "Criar nova conta de anúncios".', 'Click "Add" and then "Create a new ad account".', 'Haz clic en "Añadir" y luego en "Crear nueva cuenta publicitaria".'),
            t('Escolha o fuso horário e a moeda certos (não dá para mudar depois).', 'Choose the right time zone and currency (they cannot be changed later).', 'Elige la zona horaria y la moneda correctas (no se pueden cambiar después).'),
          ],
        },
        {
          text: t(
            'Ainda em "Contas", adicione a sua Página do Facebook (em "Páginas") e conecte o seu Instagram (em "Contas do Instagram").',
            'Still in "Accounts", add your Facebook Page (under "Pages") and connect your Instagram (under "Instagram accounts").',
            'Todavía en "Cuentas", agrega tu Página de Facebook (en "Páginas") y conecta tu Instagram (en "Cuentas de Instagram").'
          ),
        },
        {
          text: t(
            'Agora dê o acesso para a agência seguindo o passo a passo de quem já tem conta (a partir do passo 2).',
            'Now give access to the agency following the steps for those who already have an account (starting from step 2).',
            'Ahora dale acceso a la agencia siguiendo el paso a paso de quien ya tiene cuenta (a partir del paso 2).'
          ),
        },
      ],
      noAccountLink: 'https://business.facebook.com/overview',
      noAccountLinkLabel: t('Criar no Meta Business', 'Create in Meta Business', 'Crear en Meta Business'),
    };
  }
  return {
    name: 'Google Ads',
    link: 'https://ads.google.com/aw/accountaccess/users',
    linkLabel: t('Abrir Google Ads', 'Open Google Ads', 'Abrir Google Ads'),
    hasAccount: [
      {
        text: t(
          'Abra o Google Ads pelo botão abaixo. Se tiver mais de uma conta, escolha a da empresa.',
          'Open Google Ads with the button below. If you have more than one account, pick the business one.',
          'Abre Google Ads con el botón de abajo. Si tienes más de una cuenta, elige la de la empresa.'
        ),
      },
      {
        text: t(
          'Se não abrir direto: no menu da esquerda, clique em "Administrador" e depois em "Acesso e segurança".',
          'If it does not open directly: in the left menu, click "Admin", then "Access and security".',
          'Si no abre directo: en el menú de la izquierda, haz clic en "Administrador" y luego en "Acceso y seguridad".'
        ),
      },
      {
        text: t(
          'Clique no botão azul "+", cole o e-mail da agência e escolha o nível "Administrador".',
          'Click the blue "+" button, paste the agency email and choose the "Admin" access level.',
          'Haz clic en el botón azul "+", pega el correo de la agencia y elige el nivel "Administrador".'
        ),
      },
      {
        text: t('Envie o convite. Pronto!', 'Send the invite. Done!', 'Envía la invitación. ¡Listo!'),
      },
    ],
    refLabel: t('ID da conta, os 10 números no topo da tela (opcional)', 'Customer ID, the 10 digits at the top of the screen (optional)', 'ID de cliente, los 10 números arriba de la pantalla (opcional)'),
    refPlaceholder: '123-456-7890',
    noAccountIntro: t('No Google é mais simples deixar com a gente: criamos a conta pela nossa central de gestão e você recebe um convite no seu e-mail. Você só aceita e cadastra a forma de pagamento. A conta continua sendo sua.',
      'For Google it is simpler to leave it to us: we create the account from our manager account and you get an invite by email. You just accept it and add a payment method. The account is still yours.',
      'En Google es más simple dejarlo con nosotros: creamos la cuenta desde nuestra central de gestión y recibes una invitación por correo. Solo la aceptas y agregas el método de pago. La cuenta sigue siendo tuya.'),
    noAccount: [],
  };
};

export const ACCESS_STATUS_LABEL = (lang: Lang): Record<string, string> => {
  const t = tr(lang);
  return {
    pending: t('Falta enviar o convite', 'Invite pending', 'Falta enviar la invitación'),
    client_done: t('Conferindo', 'Checking', 'Revisando'),
    help: t('Vamos te ajudar', "We'll help you", 'Te ayudamos'),
    agency_creating: t('Nós criamos', 'We create it', 'Nosotros la creamos'),
    verified: t('Conferido', 'Confirmed', 'Confirmado'),
  };
};
