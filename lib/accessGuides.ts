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

export interface PlatformGuide {
  name: string;
  link: string;
  linkLabel: string;
  hasAccount: string[];
  refLabel: string;
  refPlaceholder: string;
  noAccountIntro: string;
  noAccount: string[];
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
        t('Abra o Meta Business pelo botão abaixo. Se aparecer uma lista de empresas, escolha a da sua marca.',
          'Open Meta Business with the button below. If you see a list of businesses, pick yours.',
          'Abre Meta Business con el botón de abajo. Si aparece una lista de empresas, elige la tuya.'),
        t('Se não abrir direto em "Pessoas": no menu da esquerda, clique em Configurações (engrenagem) e depois em "Configurações da empresa".',
          'If it does not open on "People": in the left menu, click Settings (gear icon), then "Business settings".',
          'Si no abre directo en "Personas": en el menú de la izquierda, haz clic en Configuración (engranaje) y luego en "Configuración del negocio".'),
        t('Em "Usuários", clique em "Pessoas" e depois em "Convidar pessoas". Cole o e-mail da agência.',
          'Under "Users", click "People", then "Invite people". Paste the agency email.',
          'En "Usuarios", haz clic en "Personas" y luego en "Invitar personas". Pega el correo de la agencia.'),
        t('Em "Ativos", marque a conta de anúncios, a Página e o Instagram, com controle total. Envie o convite. Pronto!',
          'Under "Assets", select the ad account, Page and Instagram, with full control. Send the invite. Done!',
          'En "Activos", marca la cuenta publicitaria, la Página e Instagram, con control total. Envía la invitación. ¡Listo!'),
      ],
      refLabel: t('ID da conta de anúncios (opcional)', 'Ad account ID (optional)', 'ID de la cuenta publicitaria (opcional)'),
      refPlaceholder: 'act_123456789',
      noAccountIntro: t('Dá para criar sozinho em poucos minutos. Você fica como dono de tudo.',
        'You can create it yourself in a few minutes. You stay the owner of everything.',
        'Puedes crearla tú mismo en pocos minutos. Tú quedas como dueño de todo.'),
      noAccount: [
        t('Abra o Meta Business pelo botão abaixo e entre com o seu Facebook pessoal. Clique em "Criar conta" (ou "Criar portfólio empresarial").',
          'Open Meta Business with the button below and log in with your personal Facebook. Click "Create account" (or "Create business portfolio").',
          'Abre Meta Business con el botón de abajo e inicia sesión con tu Facebook personal. Haz clic en "Crear cuenta" (o "Crear portfolio comercial").'),
        t('Preencha o nome da empresa, o seu nome e o e-mail comercial.',
          'Fill in the business name, your name and your work email.',
          'Completa el nombre de la empresa, tu nombre y tu correo comercial.'),
        t('Vá em Configurações > "Configurações da empresa" > Contas > "Contas de anúncios" > Adicionar > "Criar nova conta de anúncios". Escolha o fuso horário e a moeda certos (não dá para mudar depois).',
          'Go to Settings > "Business settings" > Accounts > "Ad accounts" > Add > "Create a new ad account". Pick the right time zone and currency (they cannot be changed later).',
          'Ve a Configuración > "Configuración del negocio" > Cuentas > "Cuentas publicitarias" > Agregar > "Crear una cuenta publicitaria". Elige bien la zona horaria y la moneda (no se pueden cambiar después).'),
        t('Ainda em Contas, adicione a sua Página do Facebook e conecte o seu Instagram.',
          'Still under Accounts, add your Facebook Page and connect your Instagram.',
          'En Cuentas, agrega tu Página de Facebook y conecta tu Instagram.'),
        t('Pronto: agora é só dar o acesso para a agência (Pessoas > Convidar pessoas), como no passo a passo de quem já tem conta.',
          'Done: now just give the agency access (People > Invite people), like in the steps for existing accounts.',
          'Listo: ahora solo da acceso a la agencia (Personas > Invitar personas), como en los pasos para quien ya tiene cuenta.'),
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
      t('Abra o Google Ads pelo botão abaixo. Se tiver mais de uma conta, escolha a da empresa.',
        'Open Google Ads with the button below. If you have more than one account, pick the business one.',
        'Abre Google Ads con el botón de abajo. Si tienes más de una cuenta, elige la de la empresa.'),
      t('Se não abrir direto: no menu da esquerda, clique em "Administrador" e depois em "Acesso e segurança".',
        'If it does not open directly: in the left menu, click "Admin", then "Access and security".',
        'Si no abre directo: en el menú de la izquierda, haz clic en "Administrador" y luego en "Acceso y seguridad".'),
      t('Clique no botão azul "+", cole o e-mail da agência e escolha o nível "Administrador".',
        'Click the blue "+" button, paste the agency email and choose the "Admin" access level.',
        'Haz clic en el botón azul "+", pega el correo de la agencia y elige el nivel "Administrador".'),
      t('Envie o convite. Pronto!', 'Send the invite. Done!', 'Envía la invitación. ¡Listo!'),
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
