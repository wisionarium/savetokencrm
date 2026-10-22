/**
 * A REGRA DO LOGO DA CASCA — uma só, para a barra lateral e para o celular.
 *
 * `logoDaMarca` (`lib/branding.ts`) resolve o que a interface desenha como marca:
 * logo configurado (organização > instalação) vence; sem logo, a instalação
 * batizada de "Tecla" usa o ativo do fork; qualquer outro nome fica sem imagem e
 * cai no desenho do produto ou no nome em texto.
 *
 * POR QUE UMA FUNÇÃO E NÃO DUAS CÓPIAS: a barra lateral e a faixa da home do
 * celular mostram a MESMA marca para a mesma pessoa. Antes, o fallback da Tecla
 * vivia só dentro de `InboxFilters.tsx` — o menu recolhido mostrava a inicial "T"
 * e o celular mostrava o logo, para a mesma instalação. Centralizar é o que
 * impede a terceira tela de nascer divergente.
 *
 * O nome não é comparado ao `DEFAULT_APP_NAME`: este fallback é do fork, e quem
 * configurou outro nome não deve recebê-lo. A comparação é case-insensitive e
 * ignora espaços porque `APP_NAME` vem do `.env` — que o instalador grava com o
 * que a pessoa digitou.
 */
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { LOGO_DA_TECLA, logoDaMarca } from "@/lib/branding";

describe("logoDaMarca", () => {
  it("o logo configurado vence — inclusive o da organização sobre o da instalação", () => {
    // A precedência entre camadas é resolvida pelo chamador (`||` entre
    // `activeOrg.marca.logoUrl` e `brand.logoUrl`); aqui o que se fixa é que um
    // logo existente NUNCA é trocado pelo ativo da Tecla.
    expect(logoDaMarca("Tecla", "https://cdn.exemplo.test/loja.png")).toBe(
      "https://cdn.exemplo.test/loja.png",
    );
    expect(logoDaMarca("Outro Nome", "https://cdn.exemplo.test/loja.png")).toBe(
      "https://cdn.exemplo.test/loja.png",
    );
  });

  it("instalação chamada Tecla, sem logo próprio, recebe o ativo do fork", () => {
    expect(logoDaMarca("Tecla", null)).toBe(LOGO_DA_TECLA);
    // `.env` gravado à mão não garante caixa nem ausência de espaço.
    expect(logoDaMarca("tecla", null)).toBe(LOGO_DA_TECLA);
    expect(logoDaMarca("  TECLA  ", null)).toBe(LOGO_DA_TECLA);
  });

  it("qualquer outro nome sem logo fica SEM imagem — não herda a marca de outro", () => {
    // Guarda de vacuidade do caso de cima: um `return LOGO_DA_TECLA` incondicional
    // passaria lá e daria a marca da Tecla a toda instalação.
    expect(logoDaMarca("Acme CRM", null)).toBeNull();
    expect(logoDaMarca("", null)).toBeNull();
    expect(logoDaMarca("Tecla do Vale", null)).toBeNull();
  });

  it("o ativo apontado existe em `public/`", () => {
    // Uma constante que aponta para arquivo inexistente não quebra teste nenhum:
    // vira o ícone de imagem quebrada na tela de quem instalou.
    expect(LOGO_DA_TECLA.startsWith("/")).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), "public", LOGO_DA_TECLA))).toBe(true);
  });
});
