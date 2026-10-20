import type { MetadataRoute } from "next";

import { marcaDaSaida, NEUTROS_DE_SAIDA } from "@/lib/branding/saida";
import { NAV_CATALOG } from "@/lib/navigation/catalogo";
import { ABAS_MOVEIS, rotuloDaAba } from "@/lib/navigation/mobile";

/**
 * O MANIFESTO do app instalável.
 *
 * ─── Por que ele é gerado, e não um arquivo em `public/` ────────────────────
 *
 * Pelo mesmo motivo do `app/icon.tsx`: a imagem self-host é UMA só para todas
 * as marcas, e o nome/cor vêm do BANCO (`platform_branding`) em runtime. Um
 * `manifest.webmanifest` estático daria o nome e a cor de quem buildou para
 * todo revendedor — o vazamento de marca que a doutrina de white-label paga.
 *
 * ─── `force-dynamic` pelo mesmo motivo do favicon ───────────────────────────
 *
 * Medido no `next build`: sem esta linha o manifest sai `○ Static`, isto é, o
 * `marcaDaSaida(null)` roda UMA vez na máquina que constrói e o nome/cor dela
 * ficam assados na imagem publicada. O defeito é invisível em dev e na Vercel —
 * só aparece na VPS do revendedor, que instalaria um app com o nome de outro.
 *
 * ─── O que torna o app INSTALÁVEL ───────────────────────────────────────────
 *
 * Não é este arquivo sozinho. O navegador exige, além do manifest com ícones
 * de 192 e 512 px, `start_url`, `display: standalone` e um service worker com
 * handler de `fetch` (`public/notify-sw.js`). Faltando qualquer um, o
 * `beforeinstallprompt` nunca dispara — e o convite de instalação, que é a
 * outra metade desta entrega, nunca aparece.
 *
 * O `theme_color` sai do accent da instalação; o `background_color`, do mesmo
 * neutro que o ícone usa como fundo — assim o splash de abertura não pisca
 * numa cor que a marca não tem.
 */
export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const marca = await marcaDaSaida(null);
  return {
    id: "/app",
    name: marca.nome,
    short_name: marca.nome,
    description: "Atendimento e vendas por WhatsApp com agentes de IA.",
    lang: "pt-BR",
    dir: "ltr",
    display: "standalone",
    orientation: "portrait",
    start_url: "/app",
    scope: "/",
    background_color: NEUTROS_DE_SAIDA.fundo,
    theme_color: marca.accent,
    categories: ["business", "productivity"],
    icons: [
      // `any` para a aba/tela inicial; `maskable` para o Android recortar o
      // ladrilho sem comer a marca ao meio. O mesmo arquivo serve aos dois
      // porque o desenho é centralizado com respiro (ver `app/api/pwa/icon/`).
      { src: "/api/pwa/icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/api/pwa/icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/api/pwa/icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Atalhos do toque longo no ícone instalado. Sao os MESMOS destinos das
    // abas de baixo (`ABAS_MOVEIS`) — derivados, nao uma segunda curadoria. Se o
    // dono tirar um destino da barra, ele sai daqui junto: o atalho nunca oferece
    // uma porta que a barra escondeu.
    shortcuts: ABAS_MOVEIS.flatMap((href) => {
      const destino = NAV_CATALOG.find((d) => d.href === href);
      return destino ? [{ name: rotuloDaAba(destino), url: destino.href }] : [];
    }),
  };
}
