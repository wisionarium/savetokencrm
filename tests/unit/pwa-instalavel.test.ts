import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { PUBLIC_PATHS } from "@/lib/auth/public-paths";

/**
 * O APP NO CELULAR — instalável, e sem mexer no computador.
 *
 * Este arquivo é uma CATRACA, não um teste de render: ele lê o disco e cobra as
 * peças que, quando faltam, não quebram nada de forma barulhenta. Instalação de
 * PWA é o exemplo perfeito: sem um dos quatro requisitos (manifest com ícone de
 * 192 e 512, `start_url`, `display: standalone`, service worker com handler de
 * `fetch`) o navegador simplesmente nunca oferece o convite. Nada dá erro, o
 * botão só não aparece — e ninguém descobre até um cliente perguntar.
 *
 * A outra metade guarda o requisito de produto que mais fácil se perde numa
 * refatoração: o desktop NÃO muda. A casca de celular tem de ser condicional
 * (`md:hidden`, `md:p-6`), nunca o novo padrão.
 */

const RAIZ = process.cwd();
const ler = (relativo: string) => readFileSync(path.join(RAIZ, relativo), "utf8");

describe("o app é instalável", () => {
  it("o manifest declara os ícones 192 e 512, standalone e o start_url", () => {
    const fonte = ler("app/manifest.ts");
    expect(fonte).toMatch(/sizes:\s*"192x192"/);
    expect(fonte).toMatch(/sizes:\s*"512x512"/);
    // O recorte `maskable` é o que impede o Android de comer a marca ao meio.
    expect(fonte).toMatch(/purpose:\s*"maskable"/);
    expect(fonte).toMatch(/display:\s*"standalone"/);
    expect(fonte).toMatch(/start_url:\s*"\/app"/);
  });

  it("os atalhos do ícone são as abas de baixo, derivados — não uma segunda curadoria", () => {
    // O comentário do manifest promete "os MESMOS destinos das abas". Cumprir
    // isso por escrito já falhou uma vez: a lista trazia Funis, que o dono tirou
    // da barra no 5ceeec40. Derivar de `ABAS_MOVEIS` faz a promessa valer por
    // construção.
    const fonte = ler("app/manifest.ts");
    expect(fonte).toMatch(/shortcuts:\s*ABAS_MOVEIS/);
    expect(fonte, "atalho não pode trazer de volta um destino que a barra escondeu").not.toMatch(
      /url:\s*"\/app\/kanban"/,
    );
  });

  it("o manifest é dinâmico — estático, ele assaria a marca de quem buildou", () => {
    // Medido no `next build`: sem esta linha o Next marca `/manifest.webmanifest`
    // como `○ Static` e o `marcaDaSaida(null)` roda uma vez na máquina que
    // constrói. O defeito é invisível em dev e só aparece na VPS do revendedor,
    // que instalaria um app com o nome de outro. `app/icon.tsx` carrega a mesma
    // linha pelo mesmo motivo.
    expect(ler("app/manifest.ts")).toMatch(/export const dynamic = "force-dynamic"/);
  });

  it("os ícones saem da marca da instalação, desenhados em runtime", () => {
    // Sem `force-dynamic` o `next build` desenharia o ícone UMA vez, com a marca
    // de quem buildou, e a imagem pré-buildada é a mesma para todos os clones.
    const fonte = ler("app/api/pwa/icon/[size]/route.tsx");
    expect(fonte).toMatch(/force-dynamic/);
    expect(fonte).toMatch(/marcaDaSaida/);
    expect(fonte).toMatch(/ImageResponse/);
  });

  it("a rota do ícone responde a quem não entrou — com a régua EXATA", () => {
    const casa = (p: string) => PUBLIC_PATHS.some((r) => r.test(p));
    expect(casa("/manifest.webmanifest"), "o manifest tem de ser público").toBe(true);
    expect(casa("/api/pwa/icon/192")).toBe(true);
    expect(casa("/api/pwa/icon/512")).toBe(true);
    // Nada nasce público de carona: outro tamanho ou um sub-path não passam.
    expect(casa("/api/pwa/icon/96")).toBe(false);
    expect(casa("/api/pwa/icon/512/hack")).toBe(false);
  });

  it("o service worker tem handler de fetch — sem ele não há instalação", () => {
    const fonte = ler("public/notify-sw.js");
    expect(fonte).toMatch(/addEventListener\(\s*"fetch"/);
  });

  it("o service worker NÃO guarda resposta autenticada em cache", () => {
    // O produto guarda conversa de cliente. Cache de HTML autenticado entregaria
    // a tela de uma sessão a outra no aparelho compartilhado de quem atende.
    const fonte = ler("public/notify-sw.js");
    expect(fonte).not.toMatch(/caches\.open/);
    expect(fonte).not.toMatch(/cache\.put|cache\.addAll/);
  });

  it("o layout declara o manifest, o modo iOS e o viewport de app", () => {
    const fonte = ler("app/layout.tsx");
    expect(fonte).toMatch(/manifest:\s*"\/manifest\.webmanifest"/);
    expect(fonte).toMatch(/appleWebApp/);
    // `cover` é o que habilita `env(safe-area-inset-*)`; `resizes-content` deixa
    // o teclado encolher a conversa em vez de cobrir o composer.
    expect(fonte).toMatch(/viewportFit:\s*"cover"/);
    expect(fonte).toMatch(/interactiveWidget:\s*"resizes-content"/);
    // iOS não lê o manifest para o ícone da tela inicial: precisa do <link>.
    expect(fonte).toMatch(/apple-touch-icon/);
  });
});

describe("o celular tem casca própria, e o computador não muda", () => {
  it("a barra de baixo só existe abaixo de md e sai do catálogo", () => {
    const fonte = ler("components/shell/MobileTabBar.tsx");
    expect(fonte).toMatch(/md:hidden/);
    expect(fonte).toMatch(/abasMoveis/);
  });

  it("a casca monta a barra e marca o conteúdo — o padding do celular é condicional", () => {
    const fonte = ler("app/app/_components/AppShell.tsx");
    expect(fonte).toMatch(/<MobileTabBar\s*\/>/);
    expect(fonte).toMatch(/data-conteudo=/);
    // O inbox se mede sozinho e não pode receber o padding do <main> no celular.
    expect(fonte).toMatch(/ehInbox/);
    expect(fonte).toMatch(/md:p-6/);
  });

  it("a barra some quando há conversa aberta, e isso é CSS (:has), não estado", () => {
    const css = ler("app/globals.css");
    expect(css).toMatch(/html:has\(\[data-conversa-aberta\]\)\s*\[data-barra-movel\]/);
    const layout = ler("components/inbox/InboxLayout.tsx");
    expect(layout).toMatch(/data-conversa-aberta=/);
  });

  it("a lista de conversas não nasce atrás da barra", () => {
    const fonte = ler("components/inbox/ConversationList.tsx");
    expect(fonte).toMatch(/pb-20 md:pb-0/);
  });

  it("o campo de mensagem tem 16px no celular — abaixo disso o iOS dá zoom", () => {
    const fonte = ler("components/inbox/Composer.tsx");
    expect(fonte).toMatch(/text-base md:text-sm/);
  });

  it("a ficha do contato sobe de baixo no celular", () => {
    const fonte = ler("components/inbox/InboxLayout.tsx");
    expect(fonte).toMatch(/side="bottom"/);
  });
});
