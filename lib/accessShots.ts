// Prints do passo a passo de acessos (feitos em 26/11/2026, interface do Google e do Meta em inglês).
// Imagens em public/guias/acessos/<ferramenta>/. "a" = já tem a conta (dar acesso), "b" = não tem (criar).
import { Lang } from './accessGuides';

export type ShotTool = 'google-ads' | 'meta' | 'ga4' | 'gtm';
type Cap = [string, string, string]; // pt, en, es
export type Shot = { src: string; caption: string };

const G = 'contato@cangurudigital.com.br';
const M = 'trafego@cangurudigital.com.br';

const SHOTS: Record<ShotTool, { a: Cap[]; b: Cap[] }> = {
  'google-ads': {
    a: [
      ['No Google Ads, clique em Admin no menu da esquerda.', 'In Google Ads, click Admin in the left menu.', 'En Google Ads, haz clic en Admin en el menú de la izquierda.'],
      ['Clique em Access and security.', 'Click Access and security.', 'Haz clic en Access and security.'],
      ['Abra a aba Users.', 'Open the Users tab.', 'Abre la pestaña Users.'],
      ['Clique no botão azul +.', 'Click the blue + button.', 'Haz clic en el botón azul +.'],
      [`Digite ${G} e escolha Admin.`, `Type ${G} and select Admin.`, `Escribe ${G} y elige Admin.`],
      ['Clique no botão para enviar o convite. Pronto!', 'Click the button to send the invite. Done!', 'Haz clic en el botón para enviar la invitación. ¡Listo!'],
    ],
    b: [],
  },
  meta: {
    a: [
      ['Em business.facebook.com, abra Settings > People e clique em Invite people.', 'At business.facebook.com, open Settings > People and click Invite people.', 'En business.facebook.com, abre Settings > People y haz clic en Invite people.'],
      [`Digite ${M} e clique em Next.`, `Type ${M} and click Next.`, `Escribe ${M} y haz clic en Next.`],
      ['Ligue Full access (Manage) e clique em Next.', 'Turn on Full access (Manage) and click Next.', 'Activa Full access (Manage) y haz clic en Next.'],
      ['Em cada tipo (Páginas, Contas de anúncio, Pixels, Instagram), clique em Select all, ligue Full access e clique em Next.', 'For each asset type (Pages, Ad accounts, Pixels, Instagram), click Select all, turn on Full access, then click Next.', 'En cada tipo (Páginas, Cuentas publicitarias, Píxeles, Instagram), haz clic en Select all, activa Full access y luego Next.'],
      ['Confira e clique em Invite. Pronto!', 'Review and click Invite. Done!', 'Revisa y haz clic en Invite. ¡Listo!'],
    ],
    b: [
      ['Abra o menu de portfólios e clique em Create a business portfolio.', 'Open the portfolio menu and click Create a business portfolio.', 'Abre el menú de portafolios y haz clic en Create a business portfolio.'],
      ['Digite o nome da empresa, o seu nome e o e-mail da empresa e clique em Create. Depois, siga os passos de quem já tem conta.', 'Type your business name, your name and your business email, then click Create. Then follow the steps for an existing account.', 'Escribe el nombre de la empresa, tu nombre y el correo de la empresa y haz clic en Create. Luego sigue los pasos de quien ya tiene cuenta.'],
    ],
  },
  ga4: {
    a: [
      ['No Google Analytics, clique na engrenagem (Admin) no canto de baixo à esquerda.', 'In Google Analytics, click the gear (Admin) at the bottom left.', 'En Google Analytics, haz clic en el engranaje (Admin) abajo a la izquierda.'],
      ['Clique em Account access management.', 'Click Account access management.', 'Haz clic en Account access management.'],
      ['Clique no botão azul +.', 'Click the blue + button.', 'Haz clic en el botón azul +.'],
      ['Clique em Add users.', 'Click Add users.', 'Haz clic en Add users.'],
      [`Digite ${G}, escolha Administrator e clique em Add. Pronto!`, `Type ${G}, select Administrator and click Add. Done!`, `Escribe ${G}, elige Administrator y haz clic en Add. ¡Listo!`],
    ],
    b: [
      ['Clique em Admin e depois em Create > Account.', 'Click Admin, then Create > Account.', 'Haz clic en Admin y luego en Create > Account.'],
      ['Digite o nome da sua empresa.', 'Type your business name.', 'Escribe el nombre de tu empresa.'],
      ['Desça a página e clique em Next.', 'Scroll down and click Next.', 'Baja y haz clic en Next.'],
      ['Dê um nome à propriedade e escolha o fuso e a moeda (Flórida = horário de Nova York, dólar).', 'Name your property, pick your time zone (Florida = New York time) and US Dollar.', 'Ponle nombre a la propiedad y elige zona horaria y moneda (Florida = hora de Nueva York, dólar).'],
      ['Escolha o setor e o tamanho da empresa e clique em Next.', 'Choose your industry and business size, then click Next.', 'Elige el sector y el tamaño de la empresa y haz clic en Next.'],
      ['Escolha Generate leads, clique em Create e aceite os termos. Depois, siga os passos de quem já tem conta.', 'Choose Generate leads, click Create and accept the terms. Then follow the steps for an existing account.', 'Elige Generate leads, haz clic en Create y acepta los términos. Luego sigue los pasos de quien ya tiene cuenta.'],
    ],
  },
  gtm: {
    a: [
      ['Em tagmanager.google.com, clique no seu container.', 'At tagmanager.google.com, click your container.', 'En tagmanager.google.com, haz clic en tu contenedor.'],
      ['Clique na aba Admin.', 'Click the Admin tab.', 'Haz clic en la pestaña Admin.'],
      ['Em Account, clique em User Management.', 'Under Account, click User Management.', 'En Account, haz clic en User Management.'],
      ['Clique no botão azul +.', 'Click the blue + button.', 'Haz clic en el botón azul +.'],
      ['Clique em Add users.', 'Click Add users.', 'Haz clic en Add users.'],
      [`Digite ${G} e clique no seu container.`, `Type ${G}, then click your container.`, `Escribe ${G} y haz clic en tu contenedor.`],
      ['Marque Publish e clique em Done.', 'Tick Publish and click Done.', 'Marca Publish y haz clic en Done.'],
      ['Clique em Invite. Pronto!', 'Click Invite. Done!', 'Haz clic en Invite. ¡Listo!'],
    ],
    b: [
      ['Em tagmanager.google.com, clique em Create Account.', 'At tagmanager.google.com, click Create Account.', 'En tagmanager.google.com, haz clic en Create Account.'],
      ['Digite o nome da empresa e o seu site e escolha Web.', 'Type your business name and your website, and choose Web.', 'Escribe el nombre de la empresa y tu sitio web, y elige Web.'],
      ['Clique em Create e aceite os termos. Depois, siga os passos de quem já tem conta.', 'Click Create and accept the terms. Then follow the steps for an existing account.', 'Haz clic en Create y acepta los términos. Luego sigue los pasos de quien ya tiene cuenta.'],
    ],
  },
};

export const accessShots = (tool: ShotTool, flow: 'a' | 'b', lang: Lang): Shot[] =>
  SHOTS[tool][flow].map((c, i) => ({
    src: `/guias/acessos/${tool}/${flow}${String(i + 1).padStart(2, '0')}.jpg`,
    caption: lang === 'en' ? c[1] : lang === 'es' ? c[2] : c[0],
  }));
