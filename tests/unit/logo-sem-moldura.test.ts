/**
 * O LOGO DE QUEM HOSPEDA É DESENHADO CRU — SEM MOLDURA CLARA.
 *
 * ═══ A DECISÃO, E O QUE ELA SUBSTITUI ═══
 *
 * O produto aceita UM logo só — `platform_branding.logo_url` /
 * `organizations.settings.branding` —, e não há uma segunda arte para o tema
 * escuro. Para impedir que arte escura sumisse contra `--color-surface`
 * (`#1d1c17`), a barra lateral, a tela de entrada e a prévia da tela de marca
 * passaram a desenhar um chip `dark:bg-white` por baixo do logo.
 *
 * O chip resolvia o contraste e criava outro defeito, visível na tela: um bloco
 * branco retangular em volta do PNG — no menu lateral e, no celular (onde o tema
 * segue o do sistema), na faixa da home. O dono pediu o PNG como ele é. A
 * decisão é dele, e o custo fica declarado: **arte escura precisa vir preparada
 * para os dois temas** — o app não clareia o fundo por conta própria.
 *
 * ═══ POR QUE ESTE ARQUIVO É UMA CERCA ═══
 *
 * Reintroduzir o chip não gera conflito de merge, não muda tipo nenhum e nada
 * grita na tela: é o tipo de conserto de contraste que volta em silêncio num
 * merge com a upstream. Este arquivo reprova se `bg-white` reaparecer como
 * moldura em qualquer uma das quatro superfícies que desenham o logo, e mantém
 * o controle de que as quatro continuam desenhando `<img>`.
 *
 * O que ele NÃO faz: medir pixel. Quem mede o navegador é
 * `tests/e2e/logo-sem-moldura-no-tema-escuro.spec.ts`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const RAIZ = join(__dirname, "..", "..");
const leia = (rel: string) => readFileSync(join(RAIZ, rel), "utf8");

/** Tira comentário para que uma menção em prosa não satisfaça a cerca. */
const semComentario = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

/**
 * `bg-white` como FUNDO de moldura — e não o `/10` translúcido que as bolhas do
 * inbox usam para outro fim (`dark:bg-white/10`). O lookahead deixa passar a
 * variante com opacidade e reprova a cor cheia.
 */
const MOLDURA_CLARA = /(?<![\w-])dark:bg-white(?![\/\w-])|(?<![\w-])bg-white(?![\/\w-])/;

describe("o logo do operador não leva moldura clara", () => {
  it("a BARRA LATERAL desenha o PNG cru, nos dois temas", () => {
    const fonte = semComentario(leia("components/shell/Sidebar.tsx"));
    expect(fonte, "a barra lateral voltou a embrulhar o logo num chip `bg-white`").not.toMatch(
      MOLDURA_CLARA,
    );
    expect(fonte, "a barra lateral deixou de desenhar o logo").toMatch(/<img\b/);
  });

  it("a HOME DO CELULAR (faixa da marca) também", () => {
    // É onde o bloco branco apareceu primeiro: no celular o tema segue o do
    // sistema, e o chip `dark:` virava um retângulo branco em volta do logo.
    const fonte = semComentario(leia("components/inbox/InboxFilters.tsx"));
    expect(fonte, "a faixa da marca no celular voltou a ter o chip `bg-white`").not.toMatch(
      MOLDURA_CLARA,
    );
    expect(fonte, "a faixa da marca no celular deixou de desenhar o logo").toMatch(/<img\b/);
  });

  it("a TELA DE ENTRADA repete a mesma forma", () => {
    const fonte = semComentario(leia("app/(public)/layout.tsx"));
    expect(fonte, "a tela de entrada voltou a embrulhar o logo num chip").not.toMatch(
      MOLDURA_CLARA,
    );
    expect(fonte).toMatch(/<img\b/);
  });

  it("a PRÉVIA da tela de marca prevê o que o app desenha — sem chip na caixa escura", () => {
    // Se a prévia voltar a desenhar um chip que o app não desenha, ela deixa de
    // ser prévia: o operador aprova uma coisa e recebe outra no menu.
    const fonte = semComentario(leia("components/branding/CampoDeLogo.tsx"));
    expect(
      fonte,
      "a prévia da aparência escura voltou a mostrar o logo sobre um chip que o app não desenha",
    ).not.toMatch(MOLDURA_CLARA);
  });

  it("CONTROLE: as quatro superfícies continuam sendo as que desenham o logo", () => {
    // Se uma quinta tela passar a desenhar `<img src={logo}>`, esta cerca fica
    // com escopo velho sem avisar. O número aqui é MEDIDO: em 2026-10-21,
    // `logo`/`logoUrl` chega a um `<img>` nestes quatro arquivos.
    const SUPERFICIES: [string, RegExp][] = [
      ["components/shell/Sidebar.tsx", /<img\b/],
      ["components/inbox/InboxFilters.tsx", /<img\b/],
      ["app/(public)/layout.tsx", /<img\b/],
      ["components/branding/CampoDeLogo.tsx", /<img\b/],
    ];
    for (const [arquivo, desenha] of SUPERFICIES) {
      expect(semComentario(leia(arquivo)), `${arquivo} deixou de desenhar o logo`).toMatch(desenha);
    }
  });
});
